/* global Marionette, Backbone, _, $ */

/**
 *
 * @copyright Copyright (c) 2018, Daniel Calviño Sánchez (danxuliu@gmail.com)
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

(function(OC, OCA, Marionette, Backbone, _, $) {
	'use strict';

	OCA.Talk = OCA.Talk || {};

	var roomChannel = Backbone.Radio.channel('rooms');
	var localMediaChannel = Backbone.Radio.channel('localMedia');

	OCA.Talk.Embedded = Marionette.Application.extend({
		OWNER: 1,
		MODERATOR: 2,
		USER: 3,
		GUEST: 4,
		USERSELFJOINED: 5,

		/* Must stay in sync with values in "lib/Room.php". */
		FLAG_DISCONNECTED: 0,
		FLAG_IN_CALL: 1,
		FLAG_WITH_AUDIO: 2,
		FLAG_WITH_VIDEO: 4,

		/** @property {OCA.SpreedMe.Models.Room} activeRoom  */
		activeRoom: null,

		/** @property {String} token  */
		token: null,

		/** @property {OCA.Talk.Connection} connection  */
		connection: null,

		/** @property {OCA.Talk.Signaling.base} signaling  */
		signaling: null,

		_registerPageEvents: function() {
			// Initialize button tooltips
			$('[data-toggle="tooltip"]').tooltip({trigger: 'hover'}).click(function() {
				$(this).tooltip('hide');
			});
		},

		initialize: function() {
			if (!OCA.Talk.getCurrentUser().uid) {
				this.initGuestName();
			}

			this._messageCollection = new OCA.SpreedMe.Models.ChatMessageCollection(null, {token: null});
			this._chatView = new OCA.SpreedMe.Views.ChatView({
				collection: this._messageCollection,
				model: this.activeRoom,
				id: 'chatView',
				guestNameModel: this._localStorageModel
			});

			this._messageCollection.listenTo(roomChannel, 'leaveCurrentRoom', function() {
				this.stopReceivingMessages();
			});

			this._localCallParticipantModel = new OCA.Talk.Models.LocalCallParticipantModel();
			this._localMediaModel = new OCA.Talk.Models.LocalMediaModel();
			this._callParticipantCollection = new OCA.Talk.Models.CallParticipantCollection();

			this._callView = new OCA.Talk.Views.CallView({
				localCallParticipantModel: this._localCallParticipantModel,
				localMediaModel: this._localMediaModel,
				collection: this._callParticipantCollection,
			});

			this._mediaControlsView = this._callView._localVideoView._mediaControlsView;

			this._speakingWhileMutedWarner = new OCA.Talk.Views.SpeakingWhileMutedWarner(this._localMediaModel, this._mediaControlsView);
		},
		onStart: function() {
			this.signaling = OCA.Talk.Signaling.createConnection();
			this.connection = new OCA.Talk.Connection(this);

			this.signaling.on('joinRoom', function(token) {
				if (this.token !== token) {
					return;
				}

				this.inRoom = true;
				if (this.pendingNickChange) {
					this.setGuestName(this.pendingNickChange);
					delete this.pendingNickChange;
				} else if (!OCA.Talk.getCurrentUser().uid && !this._localStorageModel.get('nick') && !this._displayedGuestNameHint) {
					OC.Notification.showTemporary(t('spreed', 'Set your name in the chat window so other participants can identify you better.'));
					this._displayedGuestNameHint = true;
				}
			}.bind(this));

			this.signaling.on('joinCall', function() {
				// Do not perform the initial adjustments when joining a call
				// again due to a forced reconnection.
				if (this._reconnectCallToken === this.activeRoom.get('token')) {
					delete this._reconnectCallToken;

					return;
				}

				delete this._reconnectCallToken;

				if (this.activeRoom.get('type') === this.ROOM_TYPE_ONE_TO_ONE) {
					this._localMediaModel.enableAudio();
					this._localMediaModel.disableVideo();

					return;
				}

				this._localMediaModel.disableAudio();
				this._localMediaModel.disableVideo();

				var participants = this.activeRoom.get('participants');
				var numberOfParticipantsAndGuests = (participants? Object.keys(participants).length: 0) +
						this.activeRoom.get('numGuests');
				if (this.signaling.isNoMcuWarningEnabled() && numberOfParticipantsAndGuests >= 5) {
					var warning = t('spreed', 'Calls with more than 4 participants without an external signaling server can experience connectivity issues and cause high load on participating devices.');
					OC.Notification.showTemporary(warning, { timeout: 30, type: 'warning' });
				}
			}.bind(this));

			this.signaling.on('leaveCall', function (token, reconnect) {
				if (reconnect) {
					this._reconnectCallToken = token;
				}
			}.bind(this));

			$(window).unload(function () {
				this.connection.leaveCurrentRoom();
				this.signaling.disconnect();
			}.bind(this));

			this._registerPageEvents();
		},

		setupWebRTC: function() {
			if (!OCA.SpreedMe.webrtc) {
				OCA.SpreedMe.initWebRTC(this);
				this._localCallParticipantModel.setWebRtc(OCA.SpreedMe.webrtc);
				this._localMediaModel.setWebRtc(OCA.SpreedMe.webrtc);
			}

			if (!OCA.SpreedMe.webrtc.capabilities.supportRTCPeerConnection) {
				localMediaChannel.trigger('webRtcNotSupported');
			} else {
				localMediaChannel.trigger('waitingForPermissions');
			}

			var participants = this.activeRoom.get('participants');
			var numberOfParticipantsAndGuests = (participants? Object.keys(participants).length: 0) +
					this.activeRoom.get('numGuests');
			if (numberOfParticipantsAndGuests >= 5) {
				this.signaling.setSendVideoIfAvailable(false);
				this._localMediaModel.disableVideo();
			} else {
				this.signaling.setSendVideoIfAvailable(true);
			}

			OCA.SpreedMe.webrtc.startMedia(this.token);
		},
		startLocalMedia: function(configuration) {
			if (this.callbackAfterMedia) {
				this.callbackAfterMedia(configuration);
				this.callbackAfterMedia = null;
			}

			localMediaChannel.trigger('startLocalMedia');
		},
		startWithoutLocalMedia: function() {
			if (this.callbackAfterMedia) {
				this.callbackAfterMedia(null);
				this.callbackAfterMedia = null;
			}

			if (OCA.SpreedMe.webrtc.capabilities.supportRTCPeerConnection) {
				localMediaChannel.trigger('startWithoutLocalMedia');
			}
		},
		setGuestName: function(name) {
			$.ajax({
				url: OC.linkToOCS('apps/spreed/api/v1/guest', 2) + this.token + '/name',
				type: 'POST',
				data: {
					displayName: name
				},
				beforeSend: function (request) {
					request.setRequestHeader('Accept', 'application/json');
				},
				success: function() {
					if (OCA.SpreedMe.webrtc) {
						this._localCallParticipantModel.setGuestName(name);
					}
				}.bind(this)
			});
		},
		initGuestName: function() {
			this._localStorageModel = new OCA.SpreedMe.Models.LocalStorageModel({ nick: '' });
			this._localStorageModel.on('change:nick', function(model, newDisplayName) {
				if (!this.token || !this.inRoom) {
					this.pendingNickChange = newDisplayName;
					return;
				}

				this.setGuestName(newDisplayName);
			}.bind(this));

			this._localStorageModel.fetch();
		},
	});

})(OC, OCA, Marionette, Backbone, _, $);
