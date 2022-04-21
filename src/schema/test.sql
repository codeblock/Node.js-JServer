CREATE DATABASE IF NOT EXISTS `test`;
USE `test`;

DROP TABLE IF EXISTS `tb_test`;
CREATE TABLE `tb_test` (
  `id` varchar(64) NOT NULL,
  `f1` varchar(64) DEFAULT NULL COMMENT 'string field',
  `f2` bigint(20) DEFAULT NULL COMMENT 'number field',
  `f3` double(10,2) DEFAULT NULL COMMENT 'number field',
  `f4` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'datetime field',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_f1` (`f1`),
  KEY `idx_f4` (`f4`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `tb_test_sub`;
CREATE TABLE `tb_test_sub` (
  `id_test` varchar(64) NOT NULL COMMENT 'FK:test.tb_test.id',
  `id` varchar(64) NOT NULL,
  `f1` varchar(64) DEFAULT NULL COMMENT 'string field',
  `f2` bigint(20) DEFAULT NULL COMMENT 'number field',
  `f3` double(10,2) DEFAULT NULL COMMENT 'number field',
  `f4` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'datetime field',
  PRIMARY KEY (`id_test`,`id`),
  KEY `idx_f4` (`f4`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COMMENT='tb_test : tb_test_sub = 1 : N';

DROP TABLE IF EXISTS `tb_user`;
CREATE TABLE `tb_user` (
  `id` varchar(64) NOT NULL,
  `name` varchar(64) NOT NULL,
  `time_created` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'created time',
  `time_login` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'latest login time',
  `time_logout` timestamp NULL DEFAULT NULL COMMENT 'latest logout time',
  `status_perm` tinyint(1) NOT NULL DEFAULT '0' COMMENT '{"-1": "denied", "0": "normal", "1": "admin"}',
  `status_join` tinyint(1) NOT NULL DEFAULT '0' COMMENT '{"0": "beginner", "1": "normal", "2": "returner"}',
  `club` varchar(64) DEFAULT NULL COMMENT 'club id',
  `exp` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT 'experience point',
  `gold` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT 'normal currency',
  `gem_paid` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT 'special currency - paid',
  `gem_free` bigint(20) unsigned NOT NULL DEFAULT '0' COMMENT 'special currency - free',
  `country` varchar(2) DEFAULT NULL,
  `token` varchar(255) DEFAULT NULL COMMENT 'Device Token (like for a FCM push)',
  `lang` varchar(2) DEFAULT NULL COMMENT 'language',
  `os` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Device OS',
  `v` varchar(64) DEFAULT NULL COMMENT 'Device Version',
  `bv` varchar(64) DEFAULT NULL COMMENT 'Bundle Version',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_name` (`name`),
  KEY `idx_time_login` (`time_login`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;
