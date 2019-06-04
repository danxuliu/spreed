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

(function(OCA, OC, $) {

	'use strict';

	OCA.Talk = OCA.Talk || {};

	/**
	 * Helper class to log debug messages in Nextcloud log.
	 *
	 * Messages are added with "log()" and periodically sent to the server (if
	 * debugging was enabled by calling "setEnabled(true)"); if a message can
	 * not be delivered it will be automatically retried until it is
	 * successfully received by the server. Even in case of a retry all the
	 * messages will be sent exactly in the same order that they were added.
	 */
	function Debug() {
		this._pendingMessages = [];

		this._isSendingMessages = false;

		this._enabled = false;
	}

	OCA.Talk.Debug = Debug;

	OCA.Talk.Debug.LogLevel = {
		DEBUG: 0,
		INFO: 1,
		WARN: 2,
		ERROR: 3,
		FATAL: 4,
	};

	/**
	 * Enables sending the messages to Nextcloud log.
	 *
	 * Messages added while debugging was still disabled will be sent once
	 * enabled.
	 */
	OCA.Talk.Debug.prototype.setEnabled = function(enabled) {
		this._enabled = enabled;

		if (!enabled) {
			window.clearInterval(this._sendInterval);

			return;
		}

		this._sendInterval = window.setInterval(function() {
			this._sendPendingMessages();
		}.bind(this), 500);
	};

	/**
	 * Returns a shortened id for the given peer.
	 *
	 * If no peer is given a shortened version of the signaling session id
	 * (which is the id of the self peer) is returned instead.
	 */
	OCA.Talk.Debug.prototype.getShortId = function(peer) {
		var shortIdLength = 10;

		if (peer) {
			return peer.id.substring(0, shortIdLength);
		}

		// Equivalent of "'?'.repeat(shortIdLength)" but compatible with IE 11.
		var shortSelfId = '??????????';
		if (OCA.SpreedMe.app.signaling && OCA.SpreedMe.app.signaling.getSessionid()) {
			shortSelfId = OCA.SpreedMe.app.signaling.getSessionid().substring(0, shortIdLength);
		}

		return shortSelfId;
	};

	/**
	 * Log a message in Nextcloud log.
	 *
	 * The given message is automatically extended with the current timestamp
	 * (unless explicitly overriden), the 10 first characters of the
	 * signaling id (if any, otherwise a placeholder is used) and the room token
	 * (unless explicitly overriden; if it is not overriden but there is no room
	 * token a placeholder is used).
	 */
	OCA.Talk.Debug.prototype.log = function(message, roomToken, logLevel, timestamp) {
		if (timestamp === undefined) {
			// PHP timestamps are in seconds; JavaScript timestamps are in
			// milliseconds.
			timestamp = Date.now() / 1000;
		}

		if (roomToken === undefined && OCA.SpreedMe.app.signaling && OCA.SpreedMe.app.signaling.currentRoomToken) {
			roomToken = OCA.SpreedMe.app.signaling.currentRoomToken;
		} else if (roomToken === undefined) {
			roomToken = 'TTTTTTTT';
		}
		message = roomToken + ' - ' + message;

		message = this.getShortId() + ' - ' + message;

		this._pendingMessages.push({
			message: message,
			logLevel: logLevel,
			timestamp: timestamp,
		});
	};

	OCA.Talk.Debug.prototype._sendPendingMessages = function() {
		if (!this._pendingMessages.length || this._isSendingMessages) {
			return;
		}

		this._isSendingMessages = true;

		this._sendMessage(this._pendingMessages[0]).done(function(/*result*/) {
			this._pendingMessages.shift();

			this._isSendingMessages = false;

			this._sendPendingMessages();
		}.bind(this)).fail(function(/*xhr, textStatus, errorThrown*/) {
			console.log('Sending pending debug message has failed.');

			this._isSendingMessages = false;
		}.bind(this));
	};

	OCA.Talk.Debug.prototype._sendMessage = function(message) {
		var defer = $.Deferred();
		$.ajax({
			url: OC.linkToOCS('apps/spreed/api/v1', 2) + 'log',
			type: 'POST',
			data: message,
			beforeSend: function (request) {
				request.setRequestHeader('Accept', 'application/json');
			},
			success: function (result) {
				defer.resolve(result);
			},
			error: function (xhr, textStatus, errorThrown) {
				defer.reject(xhr, textStatus, errorThrown);
			}
		});
		return defer;
	};

	OCA.Talk.debug = new OCA.Talk.Debug();

})(OCA, OC, $);
