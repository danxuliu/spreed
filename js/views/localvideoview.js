/* global Marionette */

/**
 *
 * @copyright Copyright (c) 2019, Daniel Calviño Sánchez (danxuliu@gmail.com)
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

(function(OCA, Marionette) {

	'use strict';

	OCA.SpreedMe = OCA.SpreedMe || {};
	OCA.Talk = OCA.Talk || {};
	OCA.SpreedMe.Views = OCA.SpreedMe.Views || {};
	OCA.Talk.Views = OCA.Talk.Views || {};

	var LocalVideoView = Marionette.View.extend({

		tagName: 'div',
		className: 'videoContainer videoView',

		id: 'localVideoContainer',

		template: function(context) {
			// OCA.Talk.Views.Templates may not have been initialized when this
			// view is initialized, so the template can not be directly
			// assigned.
			return OCA.Talk.Views.Templates['localvideoview'](context);
		},

		ui: {
			'video': 'video',
			'avatarContainer': '.avatar-container',
			'avatar': '.avatar',
			'nameIndicator': '.nameIndicator',
		},

		regions: {
			'localMediaControls': '@ui.nameIndicator',
		},

		initialize: function(options) {
			this._localCallParticipantModel = options.localCallParticipantModel;
			this._localMediaModel = options.localMediaModel;

			this.listenTo(this._localCallParticipantModel, 'change:guestName', this._handleGuestNameChange);

			this.listenTo(this._localMediaModel, 'change:localStream', this._setLocalStream);
			this.listenTo(this._localMediaModel, 'change:speaking', this._setSpeaking);
			this.listenTo(this._localMediaModel, 'change:videoEnabled', this._setVideoEnabled);

			this._localMediaControlsWrapper = new OCA.Talk.Views.VueWrapper({
				vm: new OCA.Talk.Views.Vue.LocalMediaControls({
					propsData: {
						model: this._localMediaModel,
						localCallParticipantModel: this._localCallParticipantModel
					}
				})
			});
			this._localMediaControlsWrapper._vm.$on('switchScreenToId', function(id) {
				// Propagate event.
				this.triggerMethod('switchScreenToId', id);
			}.bind(this));
		},

		onBeforeRender: function() {
			// During the rendering the regions of this view are reset, which
			// destroys its child views. If a child view has to be detached
			// instead so it can be attached back after the rendering of the
			// template finishes it is necessary to call "reset" with the
			// "preventDestroy" option (in later Marionette versions a public
			// "detachView" function was introduced instead).
			// "allowMissingEl" is needed for the first time this view is
			// rendered, as the element of the region does not exist yet at that
			// time and without that option the call would fail otherwise.
			this.getRegion('localMediaControls').reset({ preventDestroy: true, allowMissingEl: true });
		},

		onRender: function() {
			// Attach the child views again (or for the first time) after the
			// template has been rendered.
			this.showChildView('localMediaControls', this._localMediaControlsWrapper, { replaceElement: true } );

			// Match current model state.
			this._setLocalStream(this._localMediaModel, this._localMediaModel.get('localStream'));
			this._setSpeaking(this._localMediaModel, this._localMediaModel.get('speaking'));
			this._setVideoEnabled(this._localMediaModel, this._localMediaModel.get('videoEnabled'));
		},

		_setAvatar: function(userId, guestName) {
			if (userId && userId.length) {
				this.getUI('avatar').avatar(userId, 128);
			} else {
				this.getUI('avatar').imageplaceholder('?', guestName, 128);
				this.getUI('avatar').css('background-color', '#b9b9b9');
			}
		},

		_handleGuestNameChange: function(model, guestName) {
			this._setAvatar(null, guestName);
		},

		_setLocalStream: function(model, localStream) {
			if (!localStream) {
				// Do not clear the srcObject of the video element, just leave
				// the previous stream as a frozen image.

				return;
			}

			var options = {
				autoplay: true,
				mirror: true,
				muted: true
			};
			OCA.Talk.Views.attachMediaStream(localStream, this.getUI('video').get(0), options);
		},

		_setSpeaking: function(model, speaking) {
			this.$el.toggleClass('speaking', speaking);
		},

		_setVideoEnabled: function(model, videoEnabled) {
			if (videoEnabled) {
				this.getUI('avatarContainer').addClass('hidden');
				this.getUI('video').removeClass('hidden');

				return;
			}

			var userId = OCA.Talk.getCurrentUser().uid;
			var guestName = localStorage.getItem("nick");
			this._setAvatar(userId, guestName);

			this.getUI('avatarContainer').removeClass('hidden');
			this.getUI('video').addClass('hidden');
		},

	});

	OCA.Talk.Views.LocalVideoView = LocalVideoView;

})(OCA, Marionette);
