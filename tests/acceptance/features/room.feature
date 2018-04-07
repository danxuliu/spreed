Feature: room

  Scenario: create a group room
    Given I am logged in
    And I have opened the Talk app
    When I create a group room
    Then I see that the "You" room is active
    And I see that the chat is shown in the main view
    And I see that the sidebar is open
    And I see that the number of participants shown in the list is "1"
    And I see that "user0" is shown in the list of participants as a moderator

  Scenario: create a one-to-one room
    Given I am logged in
    And I have opened the Talk app
    When I create a one-to-one room with "admin"
    Then I see that the "admin" room is active
    And I see that the chat is shown in the main view
    And I see that the sidebar is open
    And I see that the number of participants shown in the list is "2"
    And I see that "user0" is shown in the list of participants as a moderator
    And I see that "admin" is shown in the list of participants as a moderator

  Scenario: rename a room
    Given I am logged in
    And I have opened the Talk app
    And I create a group room
    And I see that the "You" room is active
    When I rename the room to "Test room"
    Then I see that the "Test room" room is active

  Scenario: change between rooms
    Given I am logged in
    And I have opened the Talk app
    And I create a group room
    And I see that the "You" room is active
    And I see that the number of participants shown in the list is "1"
    And I create a one-to-one room with "admin"
    And I see that the "You" room is not active
    And I see that the "admin" room is active
    And I see that the number of participants shown in the list is "2"
    When I open the "You" room
    Then I see that the "You" room is active
    And I see that the "admin" room is not active
    And I see that the number of participants shown in the list is "1"

  Scenario: leave a room
    Given I am logged in
    And I have opened the Talk app
    And I create a group room
    And I see that the "You" room is active
    When I leave the "You" room
    Then I see that the "You" room is not shown in the list
    And I see that the empty content message is shown in the main view
    And I see that the sidebar is closed
