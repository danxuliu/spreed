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

class ParticipantListContext implements Context, ActorAwareInterface {

	use ActorAware;

	/**
	 * @return Locator
	 */
	public static function participantsTabView() {
		return Locator::forThe()->id("participantsTabView")->
				describedAs("Participants tab in the sidebar");
	}

	// TODO add participant

	/**
	 * @return Locator
	 */
	public static function participantsList() {
		return Locator::forThe()->css(".participantWithList")->
				descendantOf(self::participantsTabView())->
				describedAs("Participants list in the sidebar");
	}

	/**
	 * @return Locator
	 */
	public static function itemInParticipantsListFor($participantName) {
		return Locator::forThe()->xpath("//a/text()[normalize-space() = '$participantName']")->
				descendantOf(self::participantsList())->
				describedAs("Item for $participantName in the participants list");
	}

	/**
	 * @return Locator
	 */
	public static function moderatorIndicatorFor($participantName) {
		return Locator::forThe()->css(".participant-moderator-indicator")->
				descendantOf(self::itemInParticipantsListFor($participantName))->
				describedAs("Moderator indicator for $participantName in the participants list");
	}

	/**
	 * @Then I see that the number of participants shown in the list is :numberOfParticipants
	 */
	public function iSeeThatTheNumberOfParticipantsShownInTheListIs($numberOfParticipants) {
		// TODO
// 		PHPUnit_Framework_Assert::assertEquals($this->actor->find(self::appNavigationCurrentSectionItem(), 10)->getText(), $room);
	}

	/**
	 * @Then I see that :userName is shown in the list of participants as a moderator
	 */
	public function iSeeThatIsShownInTheListOfParticipantsAsAModerator($userName) {
		// TODO
// 		PHPUnit_Framework_Assert::assertEquals($this->actor->find(self::appNavigationCurrentSectionItem(), 10)->getText(), $room);
	}

}
