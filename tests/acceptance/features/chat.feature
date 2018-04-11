Feature: chat

  Scenario: send a message
    Given I am logged in
    And I have opened the Talk app
    And I create a group conversation
    And I see that the chat is shown in the main view
    When I send a new chat message with the text "Hello"
    Then I see that the message 1 was sent by "user0" with the text "Hello"

  Scenario: receive a message from another user
    Given I act as John
    And I am logged in as the admin
    And I have opened the Talk app
    And I create a one-to-one conversation with "user0"
    And I see that the chat is shown in the main view
    And I send a new chat message with the text "Hello"
    When I act as Jane
    And I am logged in
    And I have opened the Talk app
    And I open the "admin" conversation
    And I see that the chat is shown in the main view
    Then I see that the message 1 was sent by "admin" with the text "Hello"

  Scenario: receive a message from another user when the conversation is already open
    Given I act as John
    And I am logged in as the admin
    And I have opened the Talk app
    And I create a one-to-one conversation with "user0"
    And I see that the chat is shown in the main view
    And I act as Jane
    And I am logged in
    And I have opened the Talk app
    And I open the "admin" conversation
    And I see that the chat is shown in the main view
    When I act as John
    And I send a new chat message with the text "Hello"
    Then I act as Jane
    And I see that the message 1 was sent by "admin" with the text "Hello"

  Scenario: two users sending chat messages
    Given I act as John
    And I am logged in as the admin
    And I have opened the Talk app
    And I create a one-to-one conversation with "user0"
    And I see that the chat is shown in the main view
    And I act as Jane
    And I am logged in
    And I have opened the Talk app
    And I open the "admin" conversation
    And I see that the chat is shown in the main view
    When I act as John
    And I send a new chat message with the text "Hello"
    And I act as Jane
    And I send a new chat message with the text "Hi!"
    And I act as John
    And I send a new chat message with the text "How are you?"
    And I act as Jane
    And I send a new chat message with the text "Fine thanks, and you?"
    And I act as John
    And I send a new chat message with the text "Fine too!"
    Then I see that the message 1 was sent by "admin" with the text "Hello"
    And I see that the message 2 was sent by "user0" with the text "Hi!"
    And I see that the message 3 was sent by "admin" with the text "How are you?"
    And I see that the message 4 was sent by "user0" with the text "Fine thanks, and you?"
    And I see that the message 5 was sent by "admin" with the text "Fine too!"
    And I act as Jane
    And I see that the message 1 was sent by "admin" with the text "Hello"
    And I see that the message 2 was sent by "user0" with the text "Hi!"
    And I see that the message 3 was sent by "admin" with the text "How are you?"
    And I see that the message 4 was sent by "user0" with the text "Fine thanks, and you?"
    And I see that the message 5 was sent by "admin" with the text "Fine too!"
