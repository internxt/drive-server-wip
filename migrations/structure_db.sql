# ************************************************************
# Sequel Pro SQL dump
# Versión 4541
#
# http://www.sequelpro.com/
# https://github.com/sequelpro/sequelpro
#
# Host: 127.0.0.1 (MySQL 5.5.5-10.4.13-MariaDB-1:10.4.13+maria~focal)
# Base de datos: xCloud
# Tiempo de Generación: 2022-06-30 09:51:41 +0000
# ************************************************************


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


# Volcado de tabla appsumo
# ------------------------------------------------------------

DROP TABLE IF EXISTS `appsumo`;

CREATE TABLE `appsumo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `plan_id` varchar(255) NOT NULL,
  `uuid` varchar(36) NOT NULL,
  `invoice_item_uuid` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `appsumo_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla backups
# ------------------------------------------------------------

DROP TABLE IF EXISTS `backups`;

CREATE TABLE `backups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `path` text DEFAULT NULL,
  `fileId` varchar(24) DEFAULT NULL,
  `deviceId` int(11) DEFAULT NULL,
  `userId` int(11) DEFAULT NULL,
  `interval` int(11) DEFAULT NULL,
  `size` bigint(20) unsigned DEFAULT NULL,
  `bucket` varchar(24) DEFAULT NULL,
  `createdAt` datetime DEFAULT NULL,
  `updatedAt` datetime DEFAULT NULL,
  `encrypt_version` varchar(255) DEFAULT NULL,
  `hash` varchar(255) DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT 1,
  `lastBackupAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `deviceId` (`deviceId`),
  KEY `userId` (`userId`),
  CONSTRAINT `backups_ibfk_1` FOREIGN KEY (`deviceId`) REFERENCES `devices` (`id`),
  CONSTRAINT `backups_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla coupons
# ------------------------------------------------------------

DROP TABLE IF EXISTS `coupons`;

CREATE TABLE `coupons` (
  `code` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `times_reedemed` int(11) DEFAULT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla deleted_files
# ------------------------------------------------------------

DROP TABLE IF EXISTS `deleted_files`;

CREATE TABLE `deleted_files` (
  `file_id` varchar(24) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `folder_id` int(11) DEFAULT NULL,
  `bucket` varchar(24) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla devices
# ------------------------------------------------------------

DROP TABLE IF EXISTS `devices`;

CREATE TABLE `devices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `mac` varchar(255) NOT NULL,
  `userId` int(11) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `createdAt` datetime DEFAULT NULL,
  `updatedAt` datetime DEFAULT NULL,
  `platform` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `userId` (`userId`),
  KEY `mac_device_index` (`mac`,`userId`),
  CONSTRAINT `devices_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla files
# ------------------------------------------------------------

DROP TABLE IF EXISTS `files`;

CREATE TABLE `files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(512) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `size` bigint(20) unsigned DEFAULT NULL,
  `folder_id` int(11) DEFAULT NULL,
  `file_id` varchar(24) DEFAULT NULL,
  `bucket` varchar(24) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `encrypt_version` varchar(20) DEFAULT NULL,
  `deleted` tinyint(1) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `modification_time` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `files_folder_id_foreign_id_fk` (`folder_id`),
  KEY `files_user_id_foreign_idx` (`user_id`),
  CONSTRAINT `files_folder_id_foreign_id_fk` FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `files_user_id_foreign_idx` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla folders
# ------------------------------------------------------------

DROP TABLE IF EXISTS `folders`;

CREATE TABLE `folders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `parent_id` int(11) DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `bucket` varchar(24) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `encrypt_version` varchar(20) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id_folders_index` (`user_id`),
  KEY `folders_parent_id_idx` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;


DELIMITER ;;
/*!50003 SET SESSION SQL_MODE="IGNORE_SPACE,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION" */;;
/*!50003 CREATE */ /*!50017 DEFINER=`root`@`%` */ /*!50003 TRIGGER `copy_deleted_files_on_delete` BEFORE DELETE ON `folders` FOR EACH ROW BEGIN
			INSERT INTO xCloud.deleted_files(file_id, user_id, folder_id, bucket) select file_id, user_id, folder_id, bucket from xCloud.files where xCloud.files.folder_id = OLD.id;
			END */;;
DELIMITER ;
/*!50003 SET SESSION SQL_MODE=@OLD_SQL_MODE */;


# Volcado de tabla friend_invitations
# ------------------------------------------------------------

DROP TABLE IF EXISTS `friend_invitations`;

CREATE TABLE `friend_invitations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `host` int(11) NOT NULL,
  `guest_email` varchar(255) NOT NULL,
  `accepted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `host` (`host`),
  CONSTRAINT `friend_invitations_ibfk_1` FOREIGN KEY (`host`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla invitations
# ------------------------------------------------------------

DROP TABLE IF EXISTS `invitations`;

CREATE TABLE `invitations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `host` int(11) NOT NULL,
  `guest` int(11) NOT NULL,
  `invite_id` varchar(216) NOT NULL,
  `accepted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `host` (`host`),
  KEY `guest` (`guest`),
  CONSTRAINT `invitations_ibfk_1` FOREIGN KEY (`host`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `invitations_ibfk_2` FOREIGN KEY (`guest`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla keyserver
# ------------------------------------------------------------

DROP TABLE IF EXISTS `keyserver`;

CREATE TABLE `keyserver` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `public_key` varchar(1024) DEFAULT NULL,
  `private_key` varchar(2000) DEFAULT NULL,
  `revocation_key` varchar(1024) DEFAULT NULL,
  `encrypt_version` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `keyserver_ibfk_1` (`user_id`),
  CONSTRAINT `keyserver_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla mail_limits
# ------------------------------------------------------------

DROP TABLE IF EXISTS `mail_limits`;

CREATE TABLE `mail_limits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `mail_type` enum('invite_friend','reset_password','remove_account') NOT NULL,
  `attempts_count` int(10) NOT NULL DEFAULT 0,
  `attempts_limit` int(10) NOT NULL DEFAULT 0,
  `last_mail_sent` datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `mail_limits_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla plans
# ------------------------------------------------------------

DROP TABLE IF EXISTS `plans`;

CREATE TABLE `plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `type` enum('subscription','one_time') DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `limit` bigint(20) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `plans_name_idx` (`name`),
  CONSTRAINT `plans_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla referrals
# ------------------------------------------------------------

DROP TABLE IF EXISTS `referrals`;

CREATE TABLE `referrals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key` varchar(255) NOT NULL,
  `type` enum('storage') NOT NULL,
  `credit` bigint(20) unsigned NOT NULL,
  `steps` int(11) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla shares
# ------------------------------------------------------------

DROP TABLE IF EXISTS `shares`;

CREATE TABLE `shares` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `token` varchar(255) DEFAULT NULL,
  `user` varchar(255) DEFAULT NULL,
  `file` varchar(24) DEFAULT NULL,
  `mnemonic` mediumblob DEFAULT NULL,
  `is_folder` tinyint(1) DEFAULT 0,
  `views` int(11) DEFAULT 1,
  `encryption_key` varchar(400) DEFAULT NULL,
  `bucket` varchar(24) NOT NULL,
  `file_token` varchar(64) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `file_id` int(11) DEFAULT NULL,
  `folder_id` int(11) DEFAULT NULL,
  `times_valid` int(11) DEFAULT -1,
  `active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_UNIQUE` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla teams
# ------------------------------------------------------------

DROP TABLE IF EXISTS `teams`;

CREATE TABLE `teams` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `bridge_user` varchar(255) DEFAULT NULL,
  `bridge_password` varchar(255) DEFAULT NULL,
  `bridge_mnemonic` varchar(2000) DEFAULT NULL,
  `total_members` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla teamsinvitations
# ------------------------------------------------------------

DROP TABLE IF EXISTS `teamsinvitations`;

CREATE TABLE `teamsinvitations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_team` int(11) DEFAULT NULL,
  `user` varchar(255) DEFAULT NULL,
  `token` varchar(255) DEFAULT NULL,
  `bridge_password` varchar(2000) DEFAULT NULL,
  `mnemonic` varchar(2000) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla teamsmembers
# ------------------------------------------------------------

DROP TABLE IF EXISTS `teamsmembers`;

CREATE TABLE `teamsmembers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_team` varchar(255) DEFAULT NULL,
  `user` varchar(255) DEFAULT NULL,
  `bridge_password` varchar(2000) DEFAULT NULL,
  `bridge_mnemonic` varchar(2000) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla users
# ------------------------------------------------------------

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(60) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `lastname` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password` mediumblob NOT NULL,
  `mnemonic` mediumblob DEFAULT NULL,
  `root_folder_id` int(11) DEFAULT NULL,
  `store_mnemonic` tinyint(1) DEFAULT NULL,
  `h_key` mediumblob NOT NULL,
  `secret_2_f_a` varchar(40) DEFAULT NULL,
  `error_login_count` int(11) DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `is_email_activity_sended` tinyint(1) DEFAULT 0,
  `sync_date` datetime DEFAULT NULL,
  `uuid` varchar(36) DEFAULT NULL,
  `last_resend` datetime DEFAULT NULL,
  `credit` int(11) DEFAULT 0,
  `welcome_pack` tinyint(1) DEFAULT 0,
  `register_completed` tinyint(1) DEFAULT 1,
  `username` varchar(255) DEFAULT NULL,
  `bridge_user` varchar(255) DEFAULT NULL,
  `shared_workspace` tinyint(1) DEFAULT 0,
  `temp_key` varchar(256) DEFAULT NULL,
  `backups_bucket` varchar(255) DEFAULT NULL,
  `referral_code` varchar(255) NOT NULL,
  `referrer` varchar(255) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `referral_code` (`referral_code`),
  UNIQUE KEY `uuid` (`uuid`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `uuid_UNIQUE` (`uuid`),
  KEY `root_folder_id` (`root_folder_id`),
  KEY `referral_code_index` (`referral_code`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`root_folder_id`) REFERENCES `folders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Volcado de tabla users_referrals
# ------------------------------------------------------------

DROP TABLE IF EXISTS `users_referrals`;

CREATE TABLE `users_referrals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `referral_id` int(11) NOT NULL,
  `referred` varchar(255) DEFAULT NULL,
  `start_date` datetime NOT NULL,
  `expiration_date` datetime DEFAULT NULL,
  `applied` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `referral_id` (`referral_id`),
  CONSTRAINT `users_referrals_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `users_referrals_ibfk_2` FOREIGN KEY (`referral_id`) REFERENCES `referrals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;




/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
