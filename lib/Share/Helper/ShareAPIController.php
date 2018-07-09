<?php
declare(strict_types=1);

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

namespace OCA\Spreed\Share\Helper;

use OCA\Spreed\Exceptions\ParticipantNotFoundException;
use OCA\Spreed\Exceptions\RoomNotFoundException;
use OCA\Spreed\Manager;
use OCA\Spreed\Room;
use OCP\AppFramework\OCS\OCSNotFoundException;
use OCP\IL10N;
use OCP\IUserManager;
use OCP\Share\IShare;

/**
 * Helper of OCA\Files_Sharing\Controller\ShareAPIController for room shares.
 *
 * The methods of this class are called from the ShareAPIController to perform
 * actions or checks specific to room shares.
 */
class ShareAPIController {

	/** @var string */
	private $userId;

	/** @var IUserManager */
	private $userManager;

	/** @var Manager */
	private $manager;

	/** @var IL10N */
	private $l;

	/**
	 * ShareAPIController constructor.
	 *
	 * @param string $UserId
	 * @param IUserManager $userManager
	 * @param Manager $manager
	 * @param IL10N $l10n
	 */
	public function __construct(
			string $UserId,
			IUserManager $userManager,
			Manager $manager,
			IL10N $l10n
	) {
		$this->userId = $UserId;
		$this->userManager = $userManager;
		$this->manager = $manager;
		$this->l = $l10n;
	}

	/**
	 * Formats the specific fields of a room share for OCS output.
	 *
	 * The returned fields override those set by the main ShareAPIController.
	 *
	 * @param IShare $share
	 * @return array
	 */
	public function formatShare(IShare $share): array {
		$result = [];

		try {
			$room = $this->manager->getRoomByToken($share->getSharedWith());
		} catch (RoomNotFoundException $e) {
			return $result;
		}

		// The display name of one-to-one rooms is set to the display name of
		// the other participant.
		$roomName = $room->getName();
		if ($room->getType() === Room::ONE_TO_ONE_CALL) {
			$participantsList = $room->getParticipants()['users'];
			unset($participantsList[$this->userId]);

			$roomName = $this->userManager->get(key($participantsList))->getDisplayName();
		}

		$result['share_with_displayname'] = $roomName;

		return $result;
	}

	/**
	 * Prepares the given share to be passed to OC\Share20\Manager::createShare.
	 *
	 * @param IShare $share
	 * @param string $shareWith
	 * @param int $permissions
	 * @param string $expireDate
	 */
	public function createShare(IShare $share, string $shareWith, int $permissions, string $expireDate) {
		$share->setSharedWith($shareWith);
		$share->setPermissions($permissions);

		if ($expireDate !== '') {
			try {
				$expireDate = $this->parseDate($expireDate);
				$share->setExpirationDate($expireDate);
			} catch (\Exception $e) {
				throw new OCSNotFoundException($this->l->t('Invalid date, date format must be YYYY-MM-DD'));
			}
		}
	}

	/**
	 * Make sure that the passed date is valid ISO 8601
	 * So YYYY-MM-DD
	 * If not throw an exception
	 *
	 * Copied from \OCA\Files_Sharing\Controller\ShareAPIController::parseDate.
	 *
	 * @param string $expireDate
	 * @return \DateTime
	 * @throws \Exception
	 */
	private function parseDate(string $expireDate): \DateTime {
		try {
			$date = new \DateTime($expireDate);
		} catch (\Exception $e) {
			throw new \Exception('Invalid date. Format must be YYYY-MM-DD');
		}

		if ($date === false) {
			throw new \Exception('Invalid date. Format must be YYYY-MM-DD');
		}

		$date->setTime(0, 0, 0);

		return $date;
	}

	/**
	 * Returns whether the given user can access the given room share or not.
	 *
	 * A user can access a room share only if she is a participant of the room.
	 *
	 * @param IShare $share
	 * @param string $user
	 * @return bool
	 */
	public function canAccessShare(IShare $share, string $user): bool {
		try {
			$room = $this->manager->getRoomByToken($share->getSharedWith());
		} catch (RoomNotFoundException $e) {
			return false;
		}

		try {
			$room->getParticipant($user);
		} catch (ParticipantNotFoundException $e) {
			return false;
		}

		return true;
	}

}
