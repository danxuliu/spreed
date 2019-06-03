<?php
declare(strict_types=1);
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

namespace OCA\Spreed\Controller;

use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\ILogger;
use OCP\IRequest;

class DebugController extends AEnvironmentAwareController {

	/** @var ILogger */
	private $logger;

	public function __construct(string $appName,
								IRequest $request,
								ILogger $logger) {
		parent::__construct($appName, $request);

		$this->logger = $logger;
	}

	/**
	 * @PublicPage
	 *
	 * Logs a new message in Nextcloud log.
	 *
	 * The message could get logged at a different time than it was created, so
	 * it is possible to provide an explicit timestamp to be included in the
	 * log; note that this will be prepended to the message, although it will
	 * not replace the log timestamp.
	 *
	 * @param string $message the message to log
	 * @param int $logLevel the log level, warning by default
	 * @param string $timestamp timestamp to include, if any
	 * @return DataResponse the status code is "201 Created" if successful.
	 */
	public function log(string $message, int $logLevel = ILogger::WARN, int $timestamp = 0): DataResponse {
		if (!empty($timestamp)) {
			$message = date('Y-m-d H:i:s', $timestamp) . ' - ' . $message;
		} else {
			$message = 'XXXX-XX-XX XX:XX:XX - ' . $message;
		}

		$this->logger->log($logLevel, $message);

		return new DataResponse([], Http::STATUS_CREATED);
	}
}
