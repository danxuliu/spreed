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
import Screen from './components/Call/Screen'

(function(OCA) {

	Vue.prototype.t = t
	Vue.prototype.n = n

	OCA.Talk = Object.assign({}, OCA.Talk)
	OCA.Talk.Views = Object.assign({}, OCA.Talk.Views)
	OCA.Talk.Views.Vue = Object.assign({}, OCA.Talk.Views.Vue)

	OCA.Talk.Views.Vue.Screen = Vue.extend({
		components: {
			Screen
		},
		props: {
			localMediaModel: {
				type: Object,
				default: null
			},
			callParticipantModel: {
				type: Object,
				default: null
			},
			sharedData: {
				type: Object,
				required: true
			}
		},
		render: function(createElement) {
			return createElement('Screen', {
				props: {
					localMediaModel: this.localMediaModel,
					callParticipantModel: this.callParticipantModel,
					sharedData: this.sharedData
				}
			})
		}
	})

})(window.OCA)
