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

	/**
	 * @var Actor
	 */
	private $actor;

	/**
	 * @var array
	 */
	private $chatAncestorsByActor;

	/**
	 * @var Locator
	 */
	private $chatAncestor;

	/**
	 * @BeforeScenario
	 */
	public function initializeChatAncestors() {
		$this->chatAncestorsByActor = array();
		$this->chatAncestor = null;
	}

	/**
	 * @param Actor $actor
	 */
	public function setCurrentActor(Actor $actor) {
		$this->actor = $actor;

		if (array_key_exists($actor->getName(), $this->chatAncestorsByActor)) {
			$this->chatAncestor = $this->chatAncestorsByActor[$actor->getName()];
		} else {
			$this->chatAncestor = null;
		}
	}

	/**
	 * Sets the chat ancestor to be used in the steps performed by the given
	 * actor from that point on (until changed again).
	 *
	 * This is meant to be called from other contexts, for example, when the
	 * user joins or leaves a video call.
	 *
	 * The ChatAncestorSetter trait can be used to reduce the boilerplate needed
	 * to set the chat ancestor from other contexts.
	 *
	 * @param null|Locator $chatAncestor the chat ancestor
	 * @param Actor $actor the actor
	 */
	public function setChatAncestorForActor($chatAncestor, Actor $actor) {
		$this->chatAncestorsByActor[$actor->getName()] = $chatAncestor;
	}

	/**
	 * @return Locator
	 */
	public static function chatView($chatAncestor) {
		return Locator::forThe()->css(".chat")->
				descendantOf($chatAncestor)->
				describedAs("Chat view in Talk app");
	}

	/**
	 * @return Locator
	 */
	public static function chatMessagesList($chatAncestor) {
		return Locator::forThe()->css(".comments")->
				descendantOf(self::chatView($chatAncestor))->
				describedAs("List of received chat messages");
	}

	/**
	 * @return Locator
	 */
	public static function chatMessage($chatAncestor, $number) {
		return Locator::forThe()->xpath("li[$number]")->
				descendantOf(self::chatMessagesList($chatAncestor))->
				describedAs("Chat message $number in the list of received messages");
	}

	/**
	 * @return Locator
	 */
	public static function authorOfChatMessage($chatAncestor, $number) {
		return Locator::forThe()->css(".author")->
				descendantOf(self::chatMessage($chatAncestor, $number))->
				describedAs("Author of chat message $number in the list of received messages");
	}

	/**
	 * @return Locator
	 */
	public static function textOfChatMessage($chatAncestor, $number) {
		return Locator::forThe()->css(".message")->
				descendantOf(self::chatMessage($chatAncestor, $number))->
				describedAs("Text of chat message $number in the list of received messages");
	}

	/**
	 * @return Locator
	 */
	public static function newChatMessageInput($chatAncestor) {
		return Locator::forThe()->css(".newCommentForm div.message")->
				descendantOf(self::chatView($chatAncestor))->
				describedAs("New chat message input");
	}

	/**
	 * @When I send a new chat message with the text :message
	 */
	public function iSendANewChatMessageWith($message) {
		$this->actor->find(self::newChatMessageInput($this->chatAncestor), 10)->setValue($message . "\r");
	}

	/**
	 * @Then I see that the chat is shown in the main view
	 */
	public function iSeeThatTheChatIsShownInTheMainView() {
		PHPUnit_Framework_Assert::assertTrue($this->actor->find(self::chatView($this->chatAncestor), 10)->isVisible());
	}

	/**
	 * @Then I see that the message :number was sent by :author with the text :message
	 */
	public function iSeeThatTheMessageWasSentByWithTheText($number, $author, $message) {
		if (!WaitFor::elementToBeEventuallyShown(
				$this->actor,
				self::authorOfChatMessage($this->chatAncestor, $number),
				$timeout = 10 * $this->actor->getFindTimeoutMultiplier())) {
			PHPUnit_Framework_Assert::fail("The author of the message $number was not shown yet after $timeout seconds");
		}
		PHPUnit_Framework_Assert::assertEquals($author, $this->actor->find(self::authorOfChatMessage($this->chatAncestor, $number))->getText());

		if (!WaitFor::elementToBeEventuallyShown(
				$this->actor,
				self::textOfChatMessage($this->chatAncestor, $number, $author),
				$timeout = 10 * $this->actor->getFindTimeoutMultiplier())) {
			PHPUnit_Framework_Assert::fail("The text of the message $number was not shown yet after $timeout seconds");
		}
		PHPUnit_Framework_Assert::assertEquals($message, $this->actor->find(self::textOfChatMessage($this->chatAncestor, $number))->getText());
	}

}
