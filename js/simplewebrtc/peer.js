/* global module */

var util = require('util');
var webrtcSupport = require('webrtcsupport');
var WildEmitter = require('wildemitter');

function isAllTracksEnded(stream) {
	var isAllTracksEnded = true;
	stream.getTracks().forEach(function (t) {
		isAllTracksEnded = t.readyState === 'ended' && isAllTracksEnded;
	});
	return isAllTracksEnded;
}

function Peer(options) {
	var self = this;

	// call emitter constructor
	WildEmitter.call(this);

	this.id = options.id;
	this.parent = options.parent;
	this.type = options.type || 'video';
	this.oneway = options.oneway || false;
	this.sharemyscreen = options.sharemyscreen || false;
	this.browserPrefix = options.prefix;
	this.stream = options.stream;
	this.sendVideoIfAvailable = options.sendVideoIfAvailable === undefined ? true : options.sendVideoIfAvailable;
	this.enableDataChannels = options.enableDataChannels === undefined ? this.parent.config.enableDataChannels : options.enableDataChannels;
	this.receiveMedia = options.receiveMedia || this.parent.config.receiveMedia;
	this.channels = {};
	this.pendingDCMessages = []; // key (datachannel label) -> value (array[pending messages])
	this.sid = options.sid || Date.now().toString();
	this.pc = new RTCPeerConnection(this.parent.config.peerConnectionConfig);
	this.pc.addEventListener('icecandidate', this.onIceCandidate.bind(this));
	this.pc.addEventListener('endofcandidates', function (event) {
		self.send('endOfCandidates', event);
	});
	this.pc.addEventListener('addstream', this.handleRemoteStreamAdded.bind(this));
	this.pc.addEventListener('datachannel', this.handleDataChannelAdded.bind(this));
	this.pc.addEventListener('removestream', this.handleStreamRemoved.bind(this));
	// Just fire negotiation needed events for now
	// When browser re-negotiation handling seems to work
	// we can use this as the trigger for starting the offer/answer process
	// automatically. We'll just leave it be for now while this stabalizes.
	this.pc.addEventListener('negotiationneeded', this.emit.bind(this, 'negotiationNeeded'));
	this.pc.addEventListener('icegatheringstatechange', function () {
		OCA.Talk.debug.log('--------ICE gathering state: ' + this.pc.iceGatheringState);
	}.bind(this));
	this.pc.addEventListener('iceconnectionstatechange', function () {
		switch (this.pc.iceConnectionState) {
			case 'checking':
				OCA.Talk.debug.log('--------ICE connecting: ' + OCA.Talk.debug.getShortId(this));
				break;
			case 'connected':
			case 'completed':
				var iceConnectionState = this.pc.iceConnectionState;
				OCA.Talk.debug.log('--------ICE connection established (' + iceConnectionState + '): ' + OCA.Talk.debug.getShortId(this));

				this.pc.getStats().then(function(stats) {
					OCA.Talk.debug.log('--------ICE candidate pairs for ' + OCA.Talk.debug.getShortId(this) + ' in state ' + iceConnectionState);

					var candidateToString = function(candidate) {
						// Firefox uses the non standard "address" property
						// instead of "ip".
						var candidateString = (candidate.ip? candidate.ip: candidate.address);
						candidateString += ':' + candidate.port;
						candidateString += '/' + candidate.protocol;
						candidateString += ' (' + candidate.candidateType + ')';

						return candidateString;
					};

					var candidatePairToString = function(candidatePair) {
						var localCandidate = stats.get(candidatePair.localCandidateId);
						var remoteCandidate = stats.get(candidatePair.remoteCandidateId);

						return candidateToString(localCandidate) + ' | ' + candidateToString(remoteCandidate);
					};

					var candidatePairs = Array.from(stats.values()).filter(function(stat) {
						return stat.type === 'candidate-pair';
					});

					var selectedCandidatePair;

					candidatePairs.forEach(function(candidatePair) {
						// "selected" is not standard, but provided by Firefox.
						// In turn, Firefox does not seem to provide transport
						// stats, which are the standard way to find the
						// candidate.
						if (candidatePair.selected) {
							selectedCandidatePair = candidatePair;
						}

						OCA.Talk.debug.log('------------ICE candidate pair for ' + OCA.Talk.debug.getShortId(this) + ': ' + candidatePairToString(candidatePair));
					});

					if (!selectedCandidatePair) {
						var transport = Array.from(stats.values()).find(function(stat) {
							return stat.type === 'transport';
						});
						selectedCandidatePair = stats.get(transport.selectedCandidatePairId);
					}

					OCA.Talk.debug.log('--------ICE candidate pair selected for ' + OCA.Talk.debug.getShortId(this) + ': ' + candidatePairToString(selectedCandidatePair));
				}.bind(this));
				break;
			case 'disconnected':
				OCA.Talk.debug.log('--------ICE disconnected: ' + OCA.Talk.debug.getShortId(this));
				break;
			case 'failed':
				OCA.Talk.debug.log('--------ICE connection failed: ' + OCA.Talk.debug.getShortId(this));
				break;
			case 'closed':
				OCA.Talk.debug.log('--------ICE connection closed: ' + OCA.Talk.debug.getShortId(this));
				break;
		}
	}.bind(this));
	this.pc.addEventListener('iceconnectionstatechange', this.emit.bind(this, 'iceConnectionStateChange'));
	this.pc.addEventListener('iceconnectionstatechange', function () {
		switch (self.pc.iceConnectionState) {
		case 'failed':
			// currently, in chrome only the initiator goes to failed
			// so we need to signal this to the peer
			if (self.pc.localDescription.type === 'offer') {
				self.parent.emit('iceFailed', self);
				self.send('connectivityError');
			}
			break;
		}
	});
	this.pc.addEventListener('signalingstatechange', this.emit.bind(this, 'signalingStateChange'));
	this.logger = this.parent.logger;

	// handle screensharing/broadcast mode
	if (options.type === 'screen') {
		if (this.parent.localScreen && this.sharemyscreen) {
			this.logger.log('adding local screen stream to peer connection');
			this.pc.addStream(this.parent.localScreen);
			this.broadcaster = options.broadcaster;
		}
	} else {
		this.parent.localStreams.forEach(function (stream) {
			stream.getTracks().forEach(function (track) {
				if (track.kind !== 'video' || self.sendVideoIfAvailable) {
					self.pc.addTrack(track, stream);
				}
			});
		});
	}

	// proxy events to parent
	this.on('*', function () {
		self.parent.emit.apply(self.parent, arguments);
	});
}

util.inherits(Peer, WildEmitter);

Peer.prototype.offer = function(options) {
	this.pc.createOffer(options).then(function(offer) {
		OCA.Talk.debug.log('--------Set local offer for ' + OCA.Talk.debug.getShortId(this) + ': ' + offer.sdp);
		this.pc.setLocalDescription(offer).then(function() {
			if (this.parent.config.nick) {
				// The offer is a RTCSessionDescription that only serializes
				// its own attributes to JSON, so if extra attributes are needed
				// a regular object has to be sent instead.
				offer = {
					type: offer.type,
					sdp: offer.sdp,
					nick: this.parent.config.nick,
				};
			}
			this.send('offer', offer);
		}.bind(this)).catch(function(error) {
			console.warn("setLocalDescription for offer failed: ", error);
		}.bind(this));
	}.bind(this)).catch(function(error) {
		console.warn("createOffer failed: ", error);
	}.bind(this));
};

Peer.prototype.handleOffer = function (offer) {
	OCA.Talk.debug.log('--------Set remote offer for ' + OCA.Talk.debug.getShortId(this) + ': ' + offer.sdp);
	this.pc.setRemoteDescription(offer).then(function() {
		this.answer();
	}.bind(this)).catch(function(error) {
		console.warn("setRemoteDescription for offer failed: ", error);
	}.bind(this));
};

Peer.prototype.answer = function() {
	this.pc.createAnswer().then(function(answer) {
		OCA.Talk.debug.log('--------Set local answer for ' + OCA.Talk.debug.getShortId(this) + ': ' + answer.sdp);
		this.pc.setLocalDescription(answer).then(function() {
			if (this.parent.config.nick) {
				// The answer is a RTCSessionDescription that only serializes
				// its own attributes to JSON, so if extra attributes are needed
				// a regular object has to be sent instead.
				answer = {
					type: answer.type,
					sdp: answer.sdp,
					nick: this.parent.config.nick,
				};
			}
			this.send('answer', answer);
		}.bind(this)).catch(function(error) {
			console.warn("setLocalDescription for answer failed: ", error);
		}.bind(this));
	}.bind(this)).catch(function(error) {
		console.warn("createAnswer failed: ", error);
	}.bind(this));
};

Peer.prototype.handleAnswer = function (answer) {
	OCA.Talk.debug.log('--------Set remote answer for ' + OCA.Talk.debug.getShortId(this) + ': ' + answer.sdp);
	this.pc.setRemoteDescription(answer).catch(function(error) {
		console.warn("setRemoteDescription for answer failed: ", error);
	}.bind(this));
};

Peer.prototype.handleMessage = function (message) {
	var self = this;

	this.logger.log('getting', message.type, message);

	if (message.prefix) {
		this.browserPrefix = message.prefix;
	}

	if (message.type === 'offer') {
		if (!this.nick) {
			this.nick = message.payload.nick;
		}
		delete message.payload.nick;
		this.handleOffer(message.payload);
	} else if (message.type === 'answer') {
		if (!this.nick) {
			this.nick = message.payload.nick;
		}
		delete message.payload.nick;
		this.handleAnswer(message.payload);
	} else if (message.type === 'candidate') {
		OCA.Talk.debug.log('--------ICE candidate received for' + OCA.Talk.debug.getShortId(this) + ': ' + (message.payload.candidate? message.payload.candidate.candidate: 'No "candidate" property'));
		this.pc.addIceCandidate(message.payload.candidate);
	} else if (message.type === 'connectivityError') {
		this.parent.emit('connectivityError', self);
	} else if (message.type === 'mute') {
		this.parent.emit('mute', {id: message.from, name: message.payload.name});
	} else if (message.type === 'unmute') {
		this.parent.emit('unmute', {id: message.from, name: message.payload.name});
	} else if (message.type === 'endOfCandidates') {
		OCA.Talk.debug.log('--------ICE end of candidates received for ' + OCA.Talk.debug.getShortId(this));
		this.pc.addIceCandidate('');
	} else if (message.type === 'unshareScreen') {
		this.parent.emit('unshareScreen', {id: message.from});
		this.end();
	}
};

// send via signalling channel
Peer.prototype.send = function (messageType, payload) {
	var message = {
		to: this.id,
		sid: this.sid,
		broadcaster: this.broadcaster,
		roomType: this.type,
		type: messageType,
		payload: payload,
		prefix: webrtcSupport.prefix
	};
	this.logger.log('sending', messageType, message);
	this.parent.emit('message', message);
};

// send via data channel
// returns true when message was sent and false if channel is not open
Peer.prototype.sendDirectly = function (channel, messageType, payload) {
	var message = {
		type: messageType,
		payload: payload
	};
	this.logger.log('sending via datachannel', channel, messageType, message);
	var dc = this.getDataChannel(channel);
	if (dc.readyState !== 'open') {
		if (!this.pendingDCMessages.hasOwnProperty(channel)) {
			this.pendingDCMessages[channel] = [];
		}
		this.pendingDCMessages[channel].push(message);
		return false;
	}
	dc.send(JSON.stringify(message));
	return true;
};

// Internal method registering handlers for a data channel and emitting events on the peer
Peer.prototype._observeDataChannel = function (channel) {
	var self = this;
	channel.onclose = this.emit.bind(this, 'channelClose', channel);
	channel.onerror = this.emit.bind(this, 'channelError', channel);
	channel.onmessage = function (event) {
		self.emit('channelMessage', self, channel.label, JSON.parse(event.data), channel, event);
	};
	channel.onopen = function () {
		self.emit('channelOpen', channel);
		// Check if there are messages that could not be send
		if (self.pendingDCMessages.hasOwnProperty(channel.label)) {
			var pendingMessages = self.pendingDCMessages[channel.label];
			for (var i = 0; i < pendingMessages.length; i++) {
				self.sendDirectly(channel.label, pendingMessages[i].type, pendingMessages[i].payload);
			}
			self.pendingDCMessages[channel.label] = [];
		}
	};
};

// Fetch or create a data channel by the given name
Peer.prototype.getDataChannel = function (name, opts) {
	if (!webrtcSupport.supportDataChannel) {
		return this.emit('error', new Error('createDataChannel not supported'));
	}
	var channel = this.channels[name];
	opts || (opts = {});
	if (channel) {
		return channel;
	}
	// if we don't have one by this label, create it
	channel = this.channels[name] = this.pc.createDataChannel(name, opts);
	this._observeDataChannel(channel);
	return channel;
};

Peer.prototype.onIceCandidate = function (event) {
	var candidate = event.candidate;
	if (this.closed) {
		OCA.Talk.debug.log('--------ICE candidate not sent to ' + OCA.Talk.debug.getShortId(this) + ' due to being closed: ' + (candidate? candidate.candidate: 'End of candidates'));
		return;
	}
	if (candidate) {
		var pcConfig = this.parent.config.peerConnectionConfig;
		if (webrtcSupport.prefix === 'moz' && pcConfig && pcConfig.iceTransports &&
				candidate.candidate && candidate.candidate.candidate &&
				candidate.candidate.candidate.indexOf(pcConfig.iceTransports) < 0) {
			this.logger.log('Ignoring ice candidate not matching pcConfig iceTransports type: ', pcConfig.iceTransports);
		} else {
			// Retain legacy data structure for compatibility with
			// mobile clients.
			var expandedCandidate = {
				candidate: {
					candidate: candidate.candidate,
					sdpMid: candidate.sdpMid,
					sdpMLineIndex: candidate.sdpMLineIndex
				}
			};
			OCA.Talk.debug.log('--------ICE candidate sent to ' + OCA.Talk.debug.getShortId(this) + ': ' + candidate.candidate);
			this.send('candidate', expandedCandidate);
		}
	} else {
		OCA.Talk.debug.log('--------ICE end of candidates for ' + OCA.Talk.debug.getShortId(this));
		this.logger.log("End of candidates.");
	}
};

Peer.prototype.start = function () {
	// well, the webrtc api requires that we either
	// a) create a datachannel a priori
	// b) do a renegotiation later to add the SCTP m-line
	// Let's do (a) first...
	if (this.enableDataChannels) {
		this.getDataChannel('simplewebrtc');
	}

	this.offer(this.receiveMedia);
};

Peer.prototype.icerestart = function () {
	var constraints = this.receiveMedia;
	constraints.iceRestart = true;
	this.offer(constraints);
};

Peer.prototype.end = function () {
	if (this.closed) {
		return;
	}
	OCA.Talk.debug.log('--------Peer ended: ' + OCA.Talk.debug.getShortId(this));
	this.pc.close();
	this.handleStreamRemoved();
};

Peer.prototype.handleRemoteStreamAdded = function (event) {
	var self = this;
	if (this.stream) {
		this.logger.warn('Already have a remote stream');
	} else {
		this.stream = event.stream;

		this.stream.getTracks().forEach(function (track) {
			track.addEventListener('ended', function () {
				if (isAllTracksEnded(self.stream)) {
					self.end();
				}
			});
		});

		this.parent.emit('peerStreamAdded', this);
	}
};

Peer.prototype.handleStreamRemoved = function () {
	var peerIndex = this.parent.peers.indexOf(this);
	if (peerIndex > -1) {
		this.parent.peers.splice(peerIndex, 1);
		this.closed = true;
		this.parent.emit('peerStreamRemoved', this);
	}
};

Peer.prototype.handleDataChannelAdded = function (event) {
	var channel = event.channel;
	this.channels[channel.label] = channel;
	this._observeDataChannel(channel);
};

module.exports = Peer;
