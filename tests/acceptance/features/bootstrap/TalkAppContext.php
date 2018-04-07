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

class TalkAppContext implements Context, ActorAwareInterface {

	use ActorAware;

	/**
	 * @return Locator
	 */
	private static function appMenu() {
		return Locator::forThe()->id("appmenu")->
				describedAs("App menu in header");
	}

	/**
	 * @return Locator
	 */
	public static function talkItemInAppMenu() {
		return Locator::forThe()->xpath("/li[@data-id = 'spreed']")->
				descendantOf(self::appMenu())->
				describedAs("Talk item in app menu in header");
	}

	/**
	 * @return Locator
	 */
	public static function mainView() {
		return Locator::forThe()->id("app-content-wrapper")->
				describedAs("Main view in Talk app");
	}

	/**
	 * @return Locator
	 */
	public static function emptyContent() {
		return Locator::forThe()->id("emptycontent")->
				descendantOf(self::mainView())->
				describedAs("Empty content in main view");
	}

	/**
	 * @return Locator
	 */
	public static function sidebar() {
		return Locator::forThe()->id("app-sidebar")->
				describedAs("Sidebar in Talk app");
	}

	/**
	 * @return Locator
	 */
	private static function select2Dropdown() {
		return Locator::forThe()->css("#select2-drop")->
				describedAs("Select2 dropdown in Talk app");
	}

	/**
	 * @return Locator
	 */
	public static function itemInSelect2DropdownFor($text) {
		return Locator::forThe()->xpath("//*[contains(concat(' ', normalize-space(@class), ' '), ' select2-result-label ')]//span/text()[normalize-space() = '$text']/ancestor::li")->
				descendantOf(self::select2Dropdown())->
				describedAs("Item in select2 dropdown for $text in Talk app");
	}

	/**
	 * @Given I open the Talk app
	 */
	public function iOpenTheTalkApp() {
		$this->actor->find(self::talkItemInAppMenu(), 10)->click();
	}

	/**
	 * @Then I see that the current page is the Talk app
	 */
	public function iSeeThatTheCurrentPageIsTheTalkApp() {
		PHPUnit_Framework_Assert::assertStringStartsWith(
				$this->actor->locatePath("/apps/spreed/"),
				$this->actor->getSession()->getCurrentUrl());
	}

	/**
	 * @Then I see that the empty content message is shown in the main view
	 */
	public function iSeeThatTheEmptyContentMessageIsShownInTheMainView() {
		// TODO
		PHPUnit_Framework_Assert::assertTrue($this->actor->find(self::emptyContent(), 10)->isVisible());
	}

	/**
	 * @Then I see that the sidebar is open
	 */
	public function iSeeThatTheSidebarIsOpen() {
		// TODO
		PHPUnit_Framework_Assert::assertTrue($this->actor->find(self::sidebar(), 10)->isVisible());
	}

	/**
	 * @Then I see that the sidebar is closed
	 */
	public function iSeeThatTheSidebarIsClosed() {
		// TODO
		PHPUnit_Framework_Assert::assertFalse($this->actor->find(self::sidebar(), 10)->isVisible());
	}

	/**
	 * @Given I have opened the Talk app
	 */
	public function iHaveOpenedTheTalkApp() {
		$this->iOpenTheTalkApp();
		$this->iSeeThatTheCurrentPageIsTheTalkApp();
	}

}
