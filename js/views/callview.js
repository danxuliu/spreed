/* global OCA, Marionette */

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

	var CallView = Marionette.View.extend({

		tagName: 'div',
		id: 'call-container',

		template: function(context) {
			// OCA.Talk.Views.Templates may not have been initialized when this
			// view is initialized, so the template can not be directly
			// assigned.
			return OCA.Talk.Views.Templates['callview'](context);
		},

		ui: {
			'videos': '#videos',
			'localVideoContainer': '#localVideoContainer',
			'screens': '#screens',
		},

		regions: {
			'localVideo': '@ui.localVideoContainer',
		},

		collectionEvents: {
			'add': '_addVideoView',
			'remove': '_removeVideoView',
			'change:connectionState': '_handleConnectionStateChange',
			'change:speaking': '_handleSpeakingChange',
			'change:screen': '_handleScreenChange',
		},

		childViewEvents: {
			'switchScreenToId': '_switchScreenToId',
		},

		initialize: function(options) {
			this._localCallParticipantModel = options.localCallParticipantModel;

			this._localVideoWrapper = new OCA.Talk.Views.VueWrapper({
				vm: new OCA.Talk.Views.Vue.LocalVideo({
					propsData: {
						localCallParticipantModel: options.localCallParticipantModel,
						localMediaModel: options.localMediaModel,
					}
				})
			});
			this._localVideoWrapper._vm.$on('switchScreenToId', function(id) {
				this._switchScreenToId(id);
			}.bind(this));

			this.listenTo(options.localMediaModel, 'change:localScreen', this._handleLocalScreenChange);

			this._videoViews = [];
			this._screenViews = [];

			this._callViewSpeakers = new OCA.Talk.Views.CallViewSpeakers(this);
			this._callViewScreens = new OCA.Talk.Views.CallViewScreens(this);

			this._remoteParticipantsCount = 0;
			this._screenSharingActive = false;
			this._hasDarkBackground = false;

			this.render();
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
			this.getRegion('localVideo').reset({ preventDestroy: true, allowMissingEl: true });
		},

		onRender: function() {
			// Attach the child views again (or for the first time) after the
			// template has been rendered.
			this.showChildView('localVideo', this._localVideoWrapper, { replaceElement: true } );

			this._updateContainerState();
		},

		hasDarkBackground: function() {
			return this._hasDarkBackground;
		},

		_updateContainerState: function() {
			var remoteParticipantsCountOld = this._remoteParticipantsCount;
			var hasDarkBackgroundOld = this._hasDarkBackground;

			this._remoteParticipantsCount = Object.keys(this._videoViews).length;

			this.$el.removeClass('participants-' + (remoteParticipantsCountOld + 1));
			this.$el.addClass('participants-' + (this._remoteParticipantsCount + 1));
			this.$el.toggleClass('incall', this._remoteParticipantsCount > 0);
			this.$el.toggleClass('screensharing', this._screenSharingActive);

			if (this._remoteParticipantsCount > 0 || this._screenSharingActive) {
				this._hasDarkBackground = true;
			} else {
				this._hasDarkBackground = false;
			}

			if (hasDarkBackgroundOld !== this._hasDarkBackground) {
				this.trigger('hasDarkBackground', this._hasDarkBackground);
			}
		},

		_addVideoView: function(callParticipantModel) {
			if (this._videoViews[callParticipantModel.get('id')]) {
				return;
			}

			this._videoViews[callParticipantModel.get('id')] = {
				promoted: false,
				videoEnabled: true,
				screenVisible: false
			};

			var placeholderVideoWrapper = new OCA.Talk.Views.VueWrapper({
				vm: new OCA.Talk.Views.Vue.Video({
					propsData: {
						placeholderForPromoted: true,
						model: callParticipantModel,
						// The attributes can not be passsed individually, as
						// that would not replace the attributes in the object
						// with their reactive counterpart.
						sharedData: this._videoViews[callParticipantModel.get('id')]
					}
				})
			});

			var placeholderVideoWrapperId = 'placeholder-container_' + callParticipantModel.get('peerId') + '_video_incoming';

			// The new VideoWrapper is prepended to the current videos, so add
			// the placeholder first.
			this._addVideoWrapper(placeholderVideoWrapper, placeholderVideoWrapperId, 'placeholder-video-' + callParticipantModel.get('id'));

			var videoWrapper = new OCA.Talk.Views.VueWrapper({
				vm: new OCA.Talk.Views.Vue.Video({
					propsData: {
						model: callParticipantModel,
						// The attributes can not be passsed individually, as
						// that would not replace the attributes in the object
						// with their reactive counterpart.
						sharedData: this._videoViews[callParticipantModel.get('id')]
					}
				})
			});

			var videoWrapperId = 'container_' + callParticipantModel.get('peerId') + '_video_incoming';

			this._addVideoWrapper(videoWrapper, videoWrapperId, 'video-' + callParticipantModel.get('id'));

			this._updateContainerState();

			this._callViewSpeakers.add(callParticipantModel.get('id'));
		},

		_addVideoWrapper: function(videoWrapper, videoWrapperId, regionId) {
			videoWrapper._vm.$on('switchScreenToId', function(id) {
				this._switchScreenToId(id);
			}.bind(this));

			// When adding a region and showing a view on it the target element
			// of the region must exist in the parent view. Therefore, a dummy
			// target element, which will be replaced with the VideoView itself,
			// has to be added to the parent view.
			var dummyElement = '<div id="' + videoWrapperId + '"/>';
			this.getUI('videos').prepend(dummyElement);

			this.addRegion(regionId, { el: document.getElementById(videoWrapperId), replaceElement: true });
			this.showChildView(regionId, videoWrapper);
		},

		getVideoView: function(id) {
			return this._videoViews[id];
		},

		_removeVideoView: function(callParticipantModel) {
			if (!this._videoViews[callParticipantModel.get('id')]) {
				return;
			}

			this._callViewSpeakers.remove(callParticipantModel.get('id'), true);

			var removedRegion = this.removeRegion('video-' + callParticipantModel.get('id'));
			// Remove the dummy target element that was replaced by the view
			// when it was shown and that is restored back when the region is
			// removed.
			if (removedRegion.el.parentNode) {
				removedRegion.el.parentNode.removeChild(removedRegion.el);
			}

			removedRegion = this.removeRegion('placeholder-video-' + callParticipantModel.get('id'));
			if (removedRegion.el.parentNode) {
				removedRegion.el.parentNode.removeChild(removedRegion.el);
			}

			delete this._videoViews[callParticipantModel.get('id')];

			this._updateContainerState();
		},

		_handleConnectionStateChange: function(callParticipantModel, connectionState) {
			if (connectionState === OCA.Talk.Models.CallParticipantModel.ConnectionState.CLOSED) {
				this._removeVideoView(callParticipantModel);

				return;
			}

			if (this._videoViews[callParticipantModel.get('id')]) {
				return;
			}

			this._addVideoView(callParticipantModel);
		},

		_handleSpeakingChange: function(callParticipantModel, speaking) {
			if (speaking) {
				this._callViewSpeakers.add(callParticipantModel.get('id'));
			} else {
				this._callViewSpeakers.remove(callParticipantModel.get('id'));
			}
		},

		_handleScreenChange: function(callParticipantModel, screen) {
			var id = callParticipantModel.get('peerId');

			if (!screen) {
				this._removeScreenView(id);

				return;
			}

			var screenView = new OCA.Talk.Views.ScreenView({
				localMediaModel: null,
				callParticipantModel: callParticipantModel,
			});

			this._addScreenView(id, screenView);
		},

		_handleLocalScreenChange: function(localMediaModel, localScreen) {
			var id = this._localCallParticipantModel.get('peerId');

			if (!localScreen) {
				this._removeScreenView(id);

				return;
			}

			var screenView = new OCA.Talk.Views.ScreenView({
				localMediaModel: localMediaModel,
				callParticipantModel: null,
			});

			this._addScreenView(id, screenView);
		},

		isScreenSharingActive: function() {
			return this._screenSharingActive;
		},

		_setScreenSharingActive: function(active) {
			this._screenSharingActive = active;

			this._updateContainerState();
		},

		_enterScreenSharingMode: function() {
			if (this._screenSharingActive) {
				return;
			}

			this._callViewSpeakers.unpromoteLatestSpeaker();

			this._setScreenSharingActive(true);
		},

		_addScreenView: function(id, screenView) {
			if (this._screenViews[id]) {
				return;
			}

			this._enterScreenSharingMode();

			this._screenViews[id] = screenView;

			// When adding a region and showing a view on it the target element
			// of the region must exist in the parent view. Therefore, a dummy
			// target element, which will be replaced with the ScreenView
			// itself, has to be added to the parent view.
			var dummyElement = '<div id="' + screenView.id() + '"/>';
			this.getUI('screens').prepend(dummyElement);

			this.addRegion('screen-' + id, { el: document.getElementById(screenView.id()), replaceElement: true });
			this.showChildView('screen-' + id, screenView);

			this._callViewScreens.add(id);
		},

		getScreenView: function(id) {
			return this._screenViews[id];
		},

		setScreenVisible: function(id, visible) {
			if (this._screenViews[id] && visible) {
				this._screenViews[id].$el.removeClass("hidden");
			} else if (this._screenViews[id] && !visible) {
				this._screenViews[id].$el.addClass("hidden");
			}

			if (this._videoViews[id]) {
				this._videoViews[id].screenVisible = visible;
			}
		},

		_switchScreenToId: function(id) {
			this._callViewScreens.switchScreenToId(id);
		},

		_removeScreenView: function(id) {
			if (!this._screenViews[id]) {
				return;
			}

			this._callViewScreens.remove(id);

			var removedRegion = this.removeRegion('screen-' + id);
			// Remove the dummy target element that was replaced by the view
			// when it was shown and that is restored back when the region is
			// removed.
			if (removedRegion.el.parentNode) {
				removedRegion.el.parentNode.removeChild(removedRegion.el);
			}

			delete this._screenViews[id];

			this._exitScreenSharingModeIfThereAreNoScreens();
		},

		_exitScreenSharingModeIfThereAreNoScreens: function() {
			if (!this._screenSharingActive) {
				return;
			}

			if (Object.keys(this._screenViews).length > 0) {
				return;
			}

			this._setScreenSharingActive(false);

			this._callViewSpeakers.switchToUnpromotedLatestSpeaker();
		},

	});

	OCA.Talk.Views.CallView = CallView;

})(OCA, Marionette);
