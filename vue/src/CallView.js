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

import Vue from 'vue'
import CallView from './components/Call/CallView'
import initWebRTC from './utils/webrtc/webrtc'
import SpeakingWhileMutedWarner from './utils/webrtc/SpeakingWhileMutedWarner'
import CallParticipantCollection from './utils/webrtc/models/CallParticipantCollection'
import CallParticipantModel from './utils/webrtc/models/CallParticipantModel'
import LocalCallParticipantModel from './utils/webrtc/models/LocalCallParticipantModel'
import LocalMediaModel from './utils/webrtc/models/LocalMediaModel'

(function(OCA) {

	Vue.prototype.t = t
	Vue.prototype.n = n

	OCA.Talk = Object.assign({}, OCA.Talk)
	OCA.Talk.Models = Object.assign({}, OCA.Talk.Models)
	OCA.Talk.Views = Object.assign({}, OCA.Talk.Views)
	OCA.Talk.Views.Vue = Object.assign({}, OCA.Talk.Views.Vue)

	OCA.Talk.initWebRTC = initWebRTC

	OCA.Talk.Models.CallParticipantCollection = CallParticipantCollection
	OCA.Talk.Models.CallParticipantModel = CallParticipantModel
	OCA.Talk.Models.LocalCallParticipantModel = LocalCallParticipantModel
	OCA.Talk.Models.LocalMediaModel = LocalMediaModel

	OCA.Talk.Views.SpeakingWhileMutedWarner = SpeakingWhileMutedWarner

	OCA.Talk.Views.Vue.CallView = Vue.extend({
		components: {
			CallView
		},
		props: {
			localMediaModel: {
				type: Object,
				required: true
			},
			localCallParticipantModel: {
				type: Object,
				required: true
			},
			callParticipantCollection: {
				type: Object,
				required: true
			}
		},
		render: function(createElement) {
			return createElement('CallView', {
				ref: 'callView',
				props: {
					localMediaModel: this.localMediaModel,
					localCallParticipantModel: this.localCallParticipantModel,
					callParticipantCollection: this.callParticipantCollection
				},
				on: {
					'hasDarkBackground': darkBackground => { this.$emit('hasDarkBackground', darkBackground) }
				}
			})
		}
	})

})(window.OCA)
