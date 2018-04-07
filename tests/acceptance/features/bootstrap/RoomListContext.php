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

// TODO rename to conversation
class RoomListContext implements Context, ActorAwareInterface {

	use ActorAware;

	/**
	 * @return Locator
	 */
	public static function appNavigation() {
		return Locator::forThe()->id("app-navigation")->
				describedAs("App navigation");
	}

	/**
	 * @return Locator
	 */
	public static function showCreateRoomDropdownButton() {
		return Locator::forThe()->css("#oca-spreedme-add-room .select2-choice")->
				descendantOf(self::appNavigation())->
				describedAs("Show create room dropdown button in App navigation");
	}

	/**
	 * @return Locator
	 */
	public static function roomList() {
		return Locator::forThe()->id("spreedme-room-list")->
				descendantOf(self::appNavigation())->
				describedAs("Room list in App navigation");
	}

	/**
	 * @return Locator
	 */
	public static function roomListItemFor($room) {
		return Locator::forThe()->xpath("//a[normalize-space() = '$room']/ancestor::li")->
				descendantOf(self::roomList())->
				describedAs("$room item in room list in App navigation");
	}

	/**
	 * @return Locator
	 */
	public static function roomMenuButtonFor($room) {
		return Locator::forThe()->css(".app-navigation-entry-utils-menu-button button")->
				descendantOf(self::roomListItemFor($room))->
				describedAs("Menu button for $room in room list in App navigation");
	}

	/**
	 * @return Locator
	 */
	public static function roomMenuFor($room) {
		return Locator::forThe()->css(".app-navigation-entry-menu")->
				descendantOf(self::roomListItemFor($room))->
				describedAs("Menu for $room in room list in App navigation");
	}

	/**
	 * @return Locator
	 */
	private static function roomMenuItemFor($room, $item) {
		return Locator::forThe()->xpath("//button[normalize-space() = '$item']")->
				descendantOf(self::roomMenuFor($room))->
				describedAs("$item item in menu for $room in room list in App navigation");
	}

	/**
	 * @return Locator
	 */
	public static function leaveRoomMenuItemFor($room) {
		return self::roomMenuItemFor($room, "Leave room");
	}

	/**
	 * @Given I create a group room
	 */
	public function iCreateAGroupRoom() {
		// When the Talk app is opened and there are no rooms the dropdown is
		// automatically shown, and when the dropdown is shown clicking on the
		// button to open it fails because it is covered by the search field of
		// the dropdown. Due to that first it is assumed that the dropdown is
		// shown and the item is directly clicked; if it was not shown, then it
		// is explicitly shown and after that the item is clicked.
		try {
			$this->actor->find(TalkAppContext::itemInSelect2DropdownFor("New group call"), 2)->click();
		} catch (NoSuchElementException $exception) {
			$this->actor->find(self::showCreateRoomDropdownButton(), 10)->click();
			$this->actor->find(TalkAppContext::itemInSelect2DropdownFor("New group call"), 2)->click();
		}
	}

	/**
	 * @Given I create a one-to-one room with :userName
	 */
	public function iCreateAOneToOneRoomWith($userName) {
		// When the Talk app is opened and there are no rooms the dropdown is
		// automatically shown, and when the dropdown is shown clicking on the
		// button to open it fails because it is covered by the search field of
		// the dropdown. Due to that first it is assumed that the dropdown is
		// shown and the item is directly clicked; if it was not shown, then it
		// is explicitly shown and after that the item is clicked.
		try {
			$this->actor->find(TalkAppContext::itemInSelect2DropdownFor($userName), 2)->click();
		} catch (NoSuchElementException $exception) {
			$this->actor->find(self::showCreateRoomDropdownButton(), 10)->click();
			$this->actor->find(TalkAppContext::itemInSelect2DropdownFor($userName), 2)->click();
		}
	}

	/**
	 * @Given I open the :room room
	 */
	public function iOpenTheRoom($room) {
		$this->actor->find(self::roomListItemFor($room), 10)->click();
	}

	/**
	 * @Given I leave the :room room
	 */
	public function iLeaveTheRoom($room) {
		$this->actor->find(self::roomMenuButtonFor($room), 10)->click();
		$this->actor->find(self::leaveRoomMenuItemFor($room), 2)->click();
	}

	/**
	 * @Then I see that the :room room is not shown in the list
	 */
	public function iSeeThatTheRoomIsNotShownInTheList($room) {
		if (!WaitFor::elementToBeEventuallyNotShown(
				$this->actor,
				self::roomListItemFor($room),
				$timeout = 10 * $this->actor->getFindTimeoutMultiplier())) {
			PHPUnit_Framework_Assert::fail("The $room room is still shown in the list after $timeout seconds");
		}
	}

	/**
	 * @Then I see that the :room room is active
	 */
	public function iSeeThatTheRoomIsActive($room) {
		$elementLocator = self::roomListItemFor($room);

		$elementIsActiveCallback = function() use ($elementLocator) {
			try {
				return $this->actor->find($elementLocator)->getWrappedElement()->hasClass("active");
			} catch (NoSuchElementException $exception) {
				return false;
			}
		};

		if (!Utils::waitFor(
				$elementIsActiveCallback,
				$timeout = 10 * $this->actor->getFindTimeoutMultiplier(),
				$timeoutStep = 1)) {
			PHPUnit_Framework_Assert::fail("The $room room is still not active after $timeout seconds");
		}
	}

	/**
	 * @Then I see that the :room room is not active
	 */
	public function iSeeThatTheRoomIsNotActive($room) {
		$elementLocator = self::roomListItemFor($room);

		$elementIsNotActiveCallback = function() use ($elementLocator) {
			try {
				return !$this->actor->find($elementLocator)->getWrappedElement()->hasClass("active");
			} catch (NoSuchElementException $exception) {
				// The room has to appear in the list even if it is not active.
				return false;
			}
		};

		if (!Utils::waitFor(
				$elementIsNotActiveCallback,
				$timeout = 10 * $this->actor->getFindTimeoutMultiplier(),
				$timeoutStep = 1)) {
			PHPUnit_Framework_Assert::fail("The $room room is still active (or not in the list) after $timeout seconds");
		}
	}

}
