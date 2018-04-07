<?php

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

use Behat\Behat\Context\Context;

// TODO rename
class RoomInfoContext implements Context, ActorAwareInterface {

	use ActorAware;

	/**
	 * @return Locator
	 */
	public static function roomInfoContainer() {
		return Locator::forThe()->css(".detailCallInfoContainer")->
				descendantOf(TalkAppContext::sidebar())->
				describedAs("Room info container in the sidebar");
	}

	/**
	 * @return Locator
	 */
	public static function roomNameEditableTextLabel() {
		return Locator::forThe()->css(".room-name")->
				descendantOf(self::roomInfoContainer())->
				describedAs("Room name label in room info");
	}

	/**
	 * @return Locator
	 */
	public static function editRoomNameButton() {
		return Locator::forThe()->css(".edit-button")->
				descendantOf(self::roomNameEditableTextLabel())->
				describedAs("Edit room name button in room info");
	}

	/**
	 * @return Locator
	 */
	public static function roomNameTextInput() {
		return Locator::forThe()->xpath("//input[@type = 'text']")->
				descendantOf(self::roomNameEditableTextLabel())->
				describedAs("Room name text input in room info");
	}

	/**
	 * @Given I rename the room to :newRoomName
	 */
	public function iRenameTheRoomTo($newRoomName) {
		$this->actor->find(self::roomNameEditableTextLabel(), 10)->click();
		$this->actor->find(self::editRoomNameButton(), 2)->click();
		$this->actor->find(self::roomNameTextInput(), 2)->setValue($newRoomName . "\r");
	}

}
