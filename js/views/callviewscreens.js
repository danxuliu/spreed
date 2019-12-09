/* global OCA */

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

(function(OCA) {

	'use strict';

	OCA.Talk = OCA.Talk || {};
	OCA.Talk.Views = OCA.Talk.Views || {};

	function CallViewScreens(callView) {
		this._callView = callView;

		this._listOfScreens = {};
		this._latestScreenId = null;
	}
	CallViewScreens.prototype = {
		switchScreenToId: function(id) {
			var screenView = this._callView.getScreenView(id);
			if (!screenView) {
				console.warn('promote: no screen video found for ID', id);
				return;
			}

			if (this._latestScreenId === id) {
				return;
			}

			this._callView.setScreenVisible(this._latestScreenId, false);
			this._callView.setScreenVisible(id, true);

			this._latestScreenId = id;
		},
		add: function(id) {
			this._listOfScreens[id] = (new Date()).getTime();

			this.switchScreenToId(id);
		},
		remove: function(id) {
			delete this._listOfScreens[id];

			var mostRecentTime = 0,
				mostRecentId = null;
			for (var currentId in this._listOfScreens) {
				// skip loop if the property is from prototype
				if (!this._listOfScreens.hasOwnProperty(currentId)) {
					continue;
				}

				var currentTime = this._listOfScreens[currentId];
				if (currentTime > mostRecentTime) {
					mostRecentTime = currentTime;
					mostRecentId = currentId;
				}
			}

			if (mostRecentId !== null) {
				this.switchScreenToId(mostRecentId);
			}
		}
	};

	OCA.Talk.Views.CallViewScreens = CallViewScreens;

})(OCA);
