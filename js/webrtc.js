// TODO(fancycode): Should load through AMD if possible.
/* global SimpleWebRTC, OC, OCA: false */

var webrtc;
var spreedPeerConnectionTable = [];

(function(OCA, OC) {
	'use strict';

	OCA.SpreedMe = OCA.SpreedMe || {};

	var previousUsersInRoom = [];
	var usersInCallMapping = {};
	var ownPeer = null;
	var ownScreenPeer = null;
	var hasLocalMedia = false;
	var selfInCall = 0;  // OCA.SpreedMe.app.FLAG_DISCONNECTED, not available yet.
	var delayedConnectionToPeer = [];
	var callParticipantCollection = null;

	function createScreensharingPeer(signaling, sessionId) {
		var currentSessionId = signaling.getSessionid();
		var useMcu = signaling.hasFeature("mcu");

		if (useMcu && !webrtc.webrtc.getPeers(currentSessionId, 'screen').length) {
			if (ownScreenPeer) {
				ownScreenPeer.end();
			}

			// Create own publishing stream.
			ownScreenPeer = webrtc.webrtc.createPeer({
				id: currentSessionId,
				type: 'screen',
				sharemyscreen: true,
				enableDataChannels: false,
				receiveMedia: {
					offerToReceiveAudio: 0,
					offerToReceiveVideo: 0
				},
				broadcaster: currentSessionId,
			});
			webrtc.emit('createdPeer', ownScreenPeer);
			ownScreenPeer.start();
		}

		if (sessionId === currentSessionId) {
			return;
		}

		if (useMcu) {
			// TODO(jojo): Already create peer object to avoid duplicate offers.
			// TODO(jojo): We should use "requestOffer" as with regular
			// audio/video peers. Not possible right now as there is no way
			// for clients to know that screensharing is active and an offer
			// from the MCU should be requested.
			webrtc.connection.sendOffer(sessionId, "screen");
		} else if (!useMcu) {
			var screenPeers = webrtc.webrtc.getPeers(sessionId, 'screen');
			var screenPeerSharedTo = screenPeers.find(function(screenPeer) {
				return screenPeer.sharemyscreen === true;
			});
			if (!screenPeerSharedTo) {
				var peer = webrtc.webrtc.createPeer({
					id: sessionId,
					type: 'screen',
					sharemyscreen: true,
					enableDataChannels: false,
					receiveMedia: {
						offerToReceiveAudio: 0,
						offerToReceiveVideo: 0
					},
					broadcaster: currentSessionId,
				});
				webrtc.emit('createdPeer', peer);
				peer.start();
			}
		}
	}

	function checkStartPublishOwnPeer(signaling) {
		'use strict';
		var currentSessionId = signaling.getSessionid();
		if (!hasLocalMedia || webrtc.webrtc.getPeers(currentSessionId, 'video').length) {
			// No media yet or already publishing.
			return;
		}

		if (ownPeer) {
			OCA.SpreedMe.webrtc.removePeers(ownPeer.id);
			ownPeer.end();
		}

		// Create own publishing stream.
		ownPeer = webrtc.webrtc.createPeer({
			id: currentSessionId,
			type: "video",
			enableDataChannels: true,
			receiveMedia: {
				offerToReceiveAudio: 0,
				offerToReceiveVideo: 0
			},
			sendVideoIfAvailable: signaling.getSendVideoIfAvailable()
		});
		webrtc.emit('createdPeer', ownPeer);
		ownPeer.start();
	}

	function userHasStreams(user) {
		var flags = user;
		if (flags.hasOwnProperty('inCall')) {
			flags = flags.inCall;
		}
		flags = flags || OCA.SpreedMe.app.FLAG_DISCONNECTED;
		var REQUIRED_FLAGS = OCA.SpreedMe.app.FLAG_WITH_AUDIO | OCA.SpreedMe.app.FLAG_WITH_VIDEO;
		return (flags & REQUIRED_FLAGS) !== 0;
	}

	function usersChanged(signaling, newUsers, disconnectedSessionIds) {
		'use strict';
		var currentSessionId = signaling.getSessionid();

		var useMcu = signaling.hasFeature("mcu");
		if (useMcu && newUsers.length) {
			checkStartPublishOwnPeer(signaling);
		}

		newUsers.forEach(function(user) {
			if (!user.inCall) {
				return;
			}

			// TODO(fancycode): Adjust property name of internal PHP backend to be all lowercase.
			var sessionId = user.sessionId || user.sessionid;
			if (!sessionId || sessionId === currentSessionId || previousUsersInRoom.indexOf(sessionId) !== -1) {
				return;
			}

			previousUsersInRoom.push(sessionId);

			// Use null to differentiate between guest (null) and not known yet
			// (undefined).
			// TODO(fancycode): Adjust property name of internal PHP backend to be all lowercase.
			var userId = user.userId || user.userid || null;

			var callParticipantModel = callParticipantCollection.get(sessionId);
			if (!callParticipantModel) {
				callParticipantModel = callParticipantCollection.add({
					peerId: sessionId,
					webRtc: OCA.SpreedMe.webrtc,
				});
			}
			callParticipantModel.setUserId(userId);

			// When the MCU is used and the other participant has no streams or
			// when no MCU is used and neither the local participant nor the
			// other one has no streams there will be no Peer for that other
			// participant, so a null Peer needs to be explicitly set now.
			if ((signaling.hasFeature('mcu') && user && !userHasStreams(user)) ||
					(!signaling.hasFeature('mcu') && user && !userHasStreams(user) && !hasLocalMedia)) {
				callParticipantModel.setPeer(null);
			}

			var createPeer = function() {
				var peer = webrtc.webrtc.createPeer({
					id: sessionId,
					type: "video",
					enableDataChannels: true,
					receiveMedia: {
						offerToReceiveAudio: 1,
						offerToReceiveVideo: 1
					},
					sendVideoIfAvailable: signaling.getSendVideoIfAvailable()
				});
				webrtc.emit('createdPeer', peer);
				peer.start();
			};

			if (!webrtc.webrtc.getPeers(sessionId, 'video').length) {
				if (useMcu) {
					// TODO(jojo): Already create peer object to avoid duplicate offers.
					webrtc.connection.requestOffer(user, "video");

					delayedConnectionToPeer[user.sessionId] = setInterval(function() {
						console.log('No offer received for new peer, request offer again');

						webrtc.connection.requestOffer(user, 'video');
					}, 10000);
				} else if (userHasStreams(selfInCall) && (!userHasStreams(user) || sessionId < currentSessionId)) {
					// To avoid overloading the user joining a room (who previously called
					// all the other participants), we decide who calls who by comparing
					// the session ids of the users: "larger" ids call "smaller" ones.
					console.log("Starting call with", user);
					createPeer();
				} else if (userHasStreams(selfInCall) && userHasStreams(user) && sessionId > currentSessionId) {
					// If the remote peer is not aware that it was disconnected
					// from the current peer the remote peer will not send a new
					// offer; thus, if the current peer does not receive a new
					// offer in a reasonable time, the current peer calls the
					// remote peer instead of waiting to be called to
					// reestablish the connection.
					delayedConnectionToPeer[sessionId] = setInterval(function() {
						// New offers are periodically sent until a connection
						// is established. As an offer can not be sent again
						// from an existing peer it must be removed and a new
						// one must be created from scratch.
						webrtc.webrtc.getPeers(sessionId, 'video').forEach(function(peer) {
							peer.end();
						});

						console.log("No offer nor answer received, sending offer again");
						createPeer();
					}, 10000);
				}
			}

			//Send shared screen to new participants
			if (webrtc.getLocalScreen()) {
				createScreensharingPeer(signaling, sessionId);
			}
		});

		disconnectedSessionIds.forEach(function(sessionId) {
			console.log('XXX Remove peer', sessionId);
			OCA.SpreedMe.webrtc.removePeers(sessionId);
			callParticipantCollection.remove(sessionId);
			if (delayedConnectionToPeer[sessionId]) {
				clearInterval(delayedConnectionToPeer[sessionId]);
				delete delayedConnectionToPeer[sessionId];
			}
		});

		previousUsersInRoom = previousUsersInRoom.diff(disconnectedSessionIds);
	}

	function usersInCallChanged(signaling, users) {
		// The passed list are the users that are currently in the room,
		// i.e. that are in the call and should call each other.
		var currentSessionId = signaling.getSessionid();
		var currentUsersInRoom = [];
		var userMapping = {};
		selfInCall = OCA.SpreedMe.app.FLAG_DISCONNECTED;
		var sessionId;
		for (sessionId in users) {
			if (!users.hasOwnProperty(sessionId)) {
				continue;
			}
			var user = users[sessionId];
			if (!user.inCall) {
				continue;
			}

			if (sessionId === currentSessionId) {
				selfInCall = user.inCall;
				continue;
			}

			currentUsersInRoom.push(sessionId);
			userMapping[sessionId] = user;
		}

		if (!selfInCall) {
			// Own session is no longer in the call, disconnect from all others.
			usersChanged(signaling, [], previousUsersInRoom);
			return;
		}

		var newSessionIds = currentUsersInRoom.diff(previousUsersInRoom);
		var disconnectedSessionIds = previousUsersInRoom.diff(currentUsersInRoom);
		var newUsers = [];
		newSessionIds.forEach(function(sessionId) {
			newUsers.push(userMapping[sessionId]);
		});
		if (newUsers.length || disconnectedSessionIds.length) {
			usersChanged(signaling, newUsers, disconnectedSessionIds);
		}
	}

	/**
	 * @param {OCA.Talk.Application} app
	 */
	function initWebRTC(app) {
		Array.prototype.diff = function(a) {
			return this.filter(function(i) {
				return a.indexOf(i) < 0;
			});
		};

		callParticipantCollection = app._callParticipantCollection;

		var signaling = app.signaling;
		signaling.on('usersLeft', function(users) {
			users.forEach(function(user) {
				delete usersInCallMapping[user];
			});
			usersChanged(signaling, [], users);
		});
		signaling.on('usersChanged', function(users) {
			users.forEach(function(user) {
				var sessionId = user.sessionId || user.sessionid;
				usersInCallMapping[sessionId] = user;
			});
			usersInCallChanged(signaling, usersInCallMapping);
		});
		signaling.on('usersInRoom', function(users) {
			usersInCallMapping = {};
			users.forEach(function(user) {
				var sessionId = user.sessionId || user.sessionid;
				usersInCallMapping[sessionId] = user;
			});
			usersInCallChanged(signaling, usersInCallMapping);
		});
		signaling.on('leaveCall', function (token, reconnect) {
			// When the MCU is used and there is a connection error the call is
			// left and then joined again to perform the reconnection. In those
			// cases the call should be kept active from the point of view of
			// WebRTC.
			if (reconnect) {
				return;
			}

			webrtc.leaveCall();
		});

		signaling.on('message', function (message) {
			if (message.type === 'answer' && message.roomType === 'video' && delayedConnectionToPeer[message.from]) {
				clearInterval(delayedConnectionToPeer[message.from]);
				delete delayedConnectionToPeer[message.from];

				return;
			}

			if (message.type !== 'offer') {
				return;
			}

			var peers = OCA.SpreedMe.webrtc.webrtc.peers;
			var stalePeer = peers.find(function(peer) {
				if (peer.sharemyscreen) {
					return false;
				}

				return peer.id === message.from && peer.type === message.roomType && peer.sid !== message.sid;
			});

			if (stalePeer) {
				stalePeer.end();
			}

			if (message.roomType === 'video' && delayedConnectionToPeer[message.from]) {
				clearInterval(delayedConnectionToPeer[message.from]);
				delete delayedConnectionToPeer[message.from];
			}

			if (!selfInCall) {
				console.log('Offer received when not in the call, ignore');

				message.type = 'offer-to-ignore';
			}

			// MCU screen offers do not include the "broadcaster" property,
			// which is expected by SimpleWebRTC in screen offers from a remote
			// peer, so it needs to be explicitly added.
			if (signaling.hasFeature("mcu") && message.roomType === 'screen') {
				message.broadcaster = message.from;
			}
		});

		webrtc = new SimpleWebRTC({
			remoteVideosEl: '',
			autoRequestMedia: true,
			debug: false,
			media: {
				audio: true,
				video: true
			},
			autoAdjustMic: false,
			audioFallback: true,
			detectSpeakingEvents: true,
			connection: signaling,
			enableDataChannels: true,
			nick: OCA.Talk.getCurrentUser().displayName
		});
		if (signaling.hasFeature('mcu')) {
			// Force "Plan-B" semantics if the MCU is used, which doesn't support
			// "Unified Plan" with SimpleWebRTC yet.
			webrtc.webrtc.config.peerConnectionConfig.sdpSemantics = 'plan-b';
		}
		OCA.SpreedMe.webrtc = webrtc;

		signaling.on('pullMessagesStoppedOnFail', function() {
			// Force leaving the call in WebRTC; when pulling messages stops due
			// to failures the room is left, and leaving the room indirectly
			// runs signaling.leaveCurrentCall(), but if the signaling fails to
			// leave the call (which is likely due to the messages failing to be
			// received) no event will be triggered and the call will not be
			// left from WebRTC point of view.
			webrtc.leaveCall();
		});

		OCA.SpreedMe.webrtc.startMedia = function (token) {
			webrtc.joinCall(token);
		};

		var sendDataChannelToAll = function(channel, message, payload) {
			// If running with MCU, the message must be sent through the
			// publishing peer and will be distributed by the MCU to subscribers.
			var conn = OCA.SpreedMe.webrtc.connection;
			if (ownPeer && conn.hasFeature && conn.hasFeature('mcu')) {
				ownPeer.sendDirectly(channel, message, payload);
				return;
			}
			OCA.SpreedMe.webrtc.sendDirectlyToAll(channel, message, payload);
		};

		OCA.SpreedMe.videos = {
			// The nick name below the avatar is distributed through the
			// DataChannel of the PeerConnection and only sent once during
			// establishment. For the MCU case, the sending PeerConnection
			// is created once and then never changed when more participants
			// join. For this, we periodically send the nick to all other
			// participants through the sending PeerConnection.
			//
			// TODO: The name for the avatar should come from the participant
			// list which already has all information and get rid of using the
			// DataChannel for this.
			startSendingNick: function(peer) {
				if (!signaling.hasFeature("mcu")) {
					return;
				}

				OCA.SpreedMe.videos.stopSendingNick(peer);
				peer.nickInterval = setInterval(function() {
					var payload;
					var user = OCA.Talk.getCurrentUser();
					if (!user.uid) {
						payload = localStorage.getItem("nick");
					} else {
						payload = {
							"name": user.displayName,
							"userid": user.uid
						};
					}
					peer.sendDirectly('status', "nickChanged", payload);
				}, 1000);
			},
			stopSendingNick: function(peer) {
				if (!peer.nickInterval) {
					return;
				}

				clearInterval(peer.nickInterval);
				peer.nickInterval = null;
			}
		};

		function handleIceConnectionStateConnected(peer) {
			// Send the current information about the video and microphone
			// state.
			if (!OCA.SpreedMe.webrtc.webrtc.isVideoEnabled()) {
				OCA.SpreedMe.webrtc.emit('videoOff');
			} else {
				OCA.SpreedMe.webrtc.emit('videoOn');
			}
			if (!OCA.SpreedMe.webrtc.webrtc.isAudioEnabled()) {
				OCA.SpreedMe.webrtc.emit('audioOff');
			} else {
				OCA.SpreedMe.webrtc.emit('audioOn');
			}
			if (!OCA.Talk.getCurrentUser()['uid']) {
				var currentGuestNick = localStorage.getItem("nick");
				sendDataChannelToAll('status', 'nickChanged', currentGuestNick);
			}

			// Reset ice restart counter for peer
			if (spreedPeerConnectionTable[peer.id] > 0) {
				spreedPeerConnectionTable[peer.id] = 0;
			}
		};

		function handleIceConnectionStateDisconnected(peer) {
			var signaling = OCA.SpreedMe.webrtc.connection;

			setTimeout(function() {
				if (peer.pc.iceConnectionState !== 'disconnected') {
					return;
				}

				peer.emit('extendedIceConnectionStateChange', 'disconnected-long');

				if (!signaling.hasFeature("mcu")) {
					// Disconnections are not handled with the MCU, only
					// failures.

					// If the peer is still disconnected after 5 seconds we try
					// ICE restart.
					if (spreedPeerConnectionTable[peer.id] < 5) {
						if (peer.pc.localDescription.type === 'offer' &&
								peer.pc.signalingState === 'stable') {
							spreedPeerConnectionTable[peer.id] ++;
							console.log('ICE restart.', peer);
							peer.icerestart();
						}
					}
				}
			}, 5000);
		};

		function handleIceConnectionStateFailed(peer) {
			var signaling = OCA.SpreedMe.webrtc.connection;

			if (!signaling.hasFeature("mcu")) {
				if (spreedPeerConnectionTable[peer.id] < 5) {
					if (peer.pc.localDescription.type === 'offer' &&
							peer.pc.signalingState === 'stable') {
						spreedPeerConnectionTable[peer.id] ++;
						console.log('ICE restart.', peer);
						peer.icerestart();
					}
				} else {
					console.log('ICE failed after 5 tries.', peer);

					peer.emit('extendedIceConnectionStateChange', 'failed-no-restart');
				}
			} else {
				// This handles ICE failures of a receiver peer; ICE failures of
				// the sender peer are handled in the "iceFailed" event.
				console.log('Request offer again', peer);

				signaling.requestOffer(peer.id, 'video');

				delayedConnectionToPeer[peer.id] = setInterval(function() {
					console.log('No offer received, request offer again', peer);

					signaling.requestOffer(peer.id, 'video');
				}, 10000);
			}
		};

		function setHandlerForIceConnectionStateChange(peer) {
			// Initialize ice restart counter for peer
			spreedPeerConnectionTable[peer.id] = 0;

			peer.pc.addEventListener('iceconnectionstatechange', function () {
				peer.emit('extendedIceConnectionStateChange', peer.pc.iceConnectionState);

				switch (peer.pc.iceConnectionState) {
					case 'checking':
						console.log('Connecting to peer...', peer);

						break;
					case 'connected':
					case 'completed': // on caller side
						console.log('Connection established.', peer);

						handleIceConnectionStateConnected(peer);
						break;
					case 'disconnected':
						console.log('Disconnected.', peer);

						handleIceConnectionStateDisconnected(peer);
						break;
					case 'failed':
						console.log('Connection failed.', peer);

						handleIceConnectionStateFailed(peer);
						break;
					case 'closed':
						console.log('Connection closed.', peer);

						break;
				}
			});
		};

		OCA.SpreedMe.webrtc.on('createdPeer', function (peer) {
			console.log('PEER CREATED', peer);

			if (peer.id !== OCA.SpreedMe.webrtc.connection.getSessionid() && !peer.sharemyscreen) {
				// In some strange cases a Peer can be added before its
				// participant is found in the list of participants.
				var callParticipantModel = callParticipantCollection.get(peer.id);
				if (!callParticipantModel) {
					callParticipantModel = callParticipantCollection.add({
						peerId: peer.id,
						webRtc: OCA.SpreedMe.webrtc,
					});
				}

				if (peer.type === 'video') {
					callParticipantModel.setPeer(peer);
				} else {
					callParticipantModel.setScreenPeer(peer);
				}
			}

			if (peer.type === 'video') {
				if (peer.id === OCA.SpreedMe.webrtc.connection.getSessionid()) {
					console.log("Not adding ICE connection state handler for own peer", peer);

					OCA.SpreedMe.videos.startSendingNick(peer);
				} else {
					setHandlerForIceConnectionStateChange(peer);
				}

				// Make sure required data channels exist for all peers. This
				// is required for peers that get created by SimpleWebRTC from
				// received "Offer" messages. Otherwise the "channelMessage"
				// will not be called.
				peer.getDataChannel('status');
			}
		});

		function checkPeerMedia(peer, track, mediaType) {
			var defer = $.Deferred();
			peer.pc.getStats(track).then(function(stats) {
				var result = false;
				stats.forEach(function(statsReport) {
					if (result || statsReport.mediaType !== mediaType || !statsReport.hasOwnProperty('bytesReceived')) {
						return;
					}

					if (statsReport.bytesReceived > 0) {
						OCA.SpreedMe.webrtc.emit('unmute', {
							id: peer.id,
							name: mediaType
						});
						result = true;
					}
				});
				if (result) {
					defer.resolve();
				} else {
					defer.reject();
				}
			});
			return defer;
		}

		function stopPeerCheckMedia(peer) {
			if (peer.check_audio_interval) {
				clearInterval(peer.check_audio_interval);
				peer.check_audio_interval = null;
			}
			if (peer.check_video_interval) {
				clearInterval(peer.check_video_interval);
				peer.check_video_interval = null;
			}
			OCA.SpreedMe.videos.stopSendingNick(peer);
		}

		function startPeerCheckMedia(peer, stream) {
			stopPeerCheckMedia(peer);
			peer.check_video_interval = setInterval(function() {
				stream.getVideoTracks().forEach(function(video) {
					checkPeerMedia(peer, video, 'video').then(function() {
						clearInterval(peer.check_video_interval);
						peer.check_video_interval = null;
					});
				});
			}, 1000);
			peer.check_audio_interval = setInterval(function() {
				stream.getAudioTracks().forEach(function(audio) {
					checkPeerMedia(peer, audio, 'audio').then(function() {
						clearInterval(peer.check_audio_interval);
						peer.check_audio_interval = null;
					});
				});
			}, 1000);
		}

		OCA.SpreedMe.webrtc.on('peerStreamAdded', function (peer) {
			// With the MCU, a newly subscribed stream might not get the
			// "audioOn"/"videoOn" messages as they are only sent when
			// a user starts publishing. Instead wait for initial data
			// and trigger events locally.
			if (!OCA.SpreedMe.app.signaling.hasFeature("mcu")) {
				return;
			}

			startPeerCheckMedia(peer, peer.stream);
		});

		OCA.SpreedMe.webrtc.on('peerStreamRemoved', function (peer) {
			stopPeerCheckMedia(peer);
		});

		var forceReconnect = function(signaling, flags) {
			if (ownPeer) {
				OCA.SpreedMe.webrtc.removePeers(ownPeer.id);
				ownPeer.end();
				ownPeer = null;
			}

			usersChanged(signaling, [], previousUsersInRoom);
			usersInCallMapping = {};
			previousUsersInRoom = [];

			// Reconnects with a new session id will trigger "usersChanged"
			// with the users in the room and that will re-establish the
			// peerconnection streams.
			// If flags are undefined the current call flags are used.
			signaling.forceReconnect(true, flags);
		};

		OCA.SpreedMe.webrtc.webrtc.on('videoOn', function () {
			var signaling = OCA.SpreedMe.app.signaling;
			if (signaling.getSendVideoIfAvailable()) {
				return;
			}

			// When enabling the local video if the video is not being sent a
			// reconnection is forced to start sending it.
			signaling.setSendVideoIfAvailable(true);

			var flags = signaling.getCurrentCallFlags();
			flags |= OCA.SpreedMe.app.FLAG_WITH_VIDEO;

			forceReconnect(signaling, flags);
		});

		OCA.SpreedMe.webrtc.webrtc.on('iceFailed', function (/* peer */) {
			var signaling = OCA.SpreedMe.app.signaling;
			if (!signaling.hasFeature("mcu")) {
				// ICE restarts will be handled by "iceConnectionStateChange"
				// above.
				return;
			}

			// For now assume the connection to the MCU is interrupted on ICE
			// failures and force a reconnection of all streams.
			forceReconnect(signaling);
		});

		var localStreamRequestedTimeout = null;
		var localStreamRequestedTimeoutNotification = null;

		var clearLocalStreamRequestedTimeoutAndHideNotification = function() {
			clearTimeout(localStreamRequestedTimeout);
			localStreamRequestedTimeout = null;

			if (localStreamRequestedTimeoutNotification) {
				OC.Notification.hide(localStreamRequestedTimeoutNotification);
				localStreamRequestedTimeoutNotification = null;
			}
		};

		// In some cases the browser may enter in a faulty state in which
		// "getUserMedia" does not return neither successfully nor with an
		// error. It is not possible to detect this except by guessing when some
		// time passes and the user has not granted nor rejected the media
		// permissions.
		OCA.SpreedMe.webrtc.on('localStreamRequested', function () {
			clearLocalStreamRequestedTimeoutAndHideNotification();

			localStreamRequestedTimeout = setTimeout(function() {
				// FIXME emit an event and handle it as needed instead of
				// calling UI code from here.
				localStreamRequestedTimeoutNotification = OC.Notification.show(t('spreed', 'This is taking longer than expected. Are the media permissions already granted (or rejected)? If yes please restart your browser, as audio and video are failing'), { type: 'error' });
			}, 10000);
		});

		signaling.on('leaveRoom', function(token) {
			if (signaling.currentRoomToken === token) {
				clearLocalStreamRequestedTimeoutAndHideNotification();
			}
		});

		OCA.SpreedMe.webrtc.on('localMediaStarted', function (configuration) {
			console.log('localMediaStarted');

			clearLocalStreamRequestedTimeoutAndHideNotification();

			app.startLocalMedia(configuration);
			hasLocalMedia = true;
			var signaling = OCA.SpreedMe.app.signaling;
			if (signaling.hasFeature("mcu")) {
				checkStartPublishOwnPeer(signaling);
			}
		});

		OCA.SpreedMe.webrtc.on('localMediaError', function(error) {
			console.log('Access to microphone & camera failed', error);

			clearLocalStreamRequestedTimeoutAndHideNotification();

			hasLocalMedia = false;
			var message;
			if ((error.name === "NotSupportedError" &&
					OCA.SpreedMe.webrtc.capabilities.supportRTCPeerConnection) ||
				(error.name === "NotAllowedError" &&
					error.message && error.message.indexOf("Only secure origins") !== -1)) {
				message = t('spreed', 'Access to microphone & camera is only possible with HTTPS');
				message += ': ' + t('spreed', 'Please move your setup to HTTPS');
			} else if (error.name === "NotAllowedError") {
				message = t('spreed', 'Access to microphone & camera was denied');
			} else if(!OCA.SpreedMe.webrtc.capabilities.support) {
				console.log('WebRTC not supported');

				message = t('spreed', 'WebRTC is not supported in your browser');
				message += ': ' + t('spreed', 'Please use a different browser like Firefox or Chrome');
			} else {
				message = t('spreed', 'Error while accessing microphone & camera');
				console.log('Error while accessing microphone & camera: ', error.message || error.name);
			}

			app.startWithoutLocalMedia({audio: false, video: false});
			OC.Notification.show(message, {
				type: 'error',
				timeout: 15,
			});
		});

		OCA.SpreedMe.webrtc.on('channelOpen', function(channel) {
			console.log('%s datachannel is open', channel.label);
		});

		OCA.SpreedMe.webrtc.on('channelMessage', function (peer, label, data) {
			if (label === 'status') {
				if(data.type === 'audioOn') {
					OCA.SpreedMe.webrtc.emit('unmute', {id: peer.id, name:'audio'});
				} else if(data.type === 'audioOff') {
					OCA.SpreedMe.webrtc.emit('mute', {id: peer.id, name:'audio'});
				} else if(data.type === 'videoOn') {
					OCA.SpreedMe.webrtc.emit('unmute', {id: peer.id, name:'video'});
				} else if(data.type === 'videoOff') {
					OCA.SpreedMe.webrtc.emit('mute', {id: peer.id, name:'video'});
				} else if (data.type === 'nickChanged') {
					var payload = data.payload || '';
					if (typeof(payload) === 'string') {
						OCA.SpreedMe.webrtc.emit('nick', {id: peer.id, name:data.payload});
						app._messageCollection.updateGuestName(new Hashes.SHA1().hex(peer.id), data.payload);
					} else {
						OCA.SpreedMe.webrtc.emit('nick', {id: peer.id, name: payload.name, userid: payload.userid});
					}
				}
			} else if (label === 'hark') {
				// Ignore messages from hark datachannel
			} else {
				console.log('Uknown message from %s datachannel', label, data);
			}
		});

		OCA.SpreedMe.webrtc.on('speaking', function(){
			sendDataChannelToAll('status', 'speaking');
		});

		OCA.SpreedMe.webrtc.on('stoppedSpeaking', function(){
			sendDataChannelToAll('status', 'stoppedSpeaking');
		});

		// Send the audio on and off events via data channel
		OCA.SpreedMe.webrtc.on('audioOn', function() {
			sendDataChannelToAll('status', 'audioOn');
		});
		OCA.SpreedMe.webrtc.on('audioOff', function() {
			sendDataChannelToAll('status', 'audioOff');
		});
		OCA.SpreedMe.webrtc.on('videoOn', function() {
			sendDataChannelToAll('status', 'videoOn');
		});
		OCA.SpreedMe.webrtc.on('videoOff', function() {
			sendDataChannelToAll('status', 'videoOff');
		});

		// Local screen added.
		OCA.SpreedMe.webrtc.on('localScreenAdded', function(video) {
			var signaling = OCA.SpreedMe.app.signaling;

			var currentSessionId = signaling.getSessionid();
			for (var sessionId in usersInCallMapping) {
				if (!usersInCallMapping.hasOwnProperty(sessionId)) {
					continue;
				} else if (!usersInCallMapping[sessionId].inCall) {
					continue;
				} else if (sessionId === currentSessionId) {
					// Running with MCU, no need to create screensharing
					// subscriber for client itself.
					continue;
				}

				createScreensharingPeer(signaling, sessionId);
			}
		});

		OCA.SpreedMe.webrtc.on('localScreenStopped', function() {
			var signaling = OCA.SpreedMe.app.signaling;

			if (!signaling.hasFeature('mcu')) {
				// Only need to notify clients here if running with MCU.
				// Otherwise SimpleWebRTC will notify each client on its own.
				return;
			}

			if (ownScreenPeer) {
				ownScreenPeer = null;

				signaling.sendRoomMessage({
					roomType: 'screen',
					type: 'unshareScreen'
				});
			}
		});
	}

	OCA.SpreedMe.initWebRTC = initWebRTC;

})(OCA, OC);
