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

class ChatContext implements Context, ActorAwareInterface {

	use ActorAware;

	/**
	 * @return Locator
	 */
	public static function appNavigationSectionItemFor($sectionText) {
		return Locator::forThe()->xpath("//li[normalize-space() = '$sectionText']")->
				descendantOf(self::appNavigation())->
				describedAs($sectionText . " section item in App Navigation");
	}

	/**
	 * @Then I see that the chat is shown in the main view
	 */
	public function iSeeThatTheChatIsShownInTheMainView() {
// 		PHPUnit_Framework_Assert::assertTrue($this->actor->find(self::(), 10)->isVisible());

		// TODO ensure that it is not shown in the details view
// 		PHPUnit_Framework_Assert::assertFalse($this->actor->find(self::(), 10)->isVisible());
	}

	// TODO see is shown in the sidebar

}
