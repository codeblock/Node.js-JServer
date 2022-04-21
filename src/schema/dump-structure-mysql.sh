#!/bin/bash

# #
#
# @see *nix environment for Windows
# @link https://git-scm.com/download/win : Git Bash
# @link https://osdn.net/projects/mingw/ : MinGW
# @link http://cygwin.com/ : Cygwin
# 
# @see mysql mysqldump for Windows
# @link https://downloads.mysql.com/archives/community/
#
# #

function dump() {
    local dbnm=$1
    local host=$2
    local port=$3
    local user=$4
    local pass=$5

    if [ -z $dbnm ]; then
        echo 'usage: '$0' db-name[ host=0.0.0.0[ port=3306[ user=...[ pass=...]]]]'
        return
    fi
    local fn=$dbnm.sql

    if [ -z $host ]; then
        host='0.0.0.0'
    fi
    if [ -z $port ]; then
        port=3306
    fi
    if [ -z $user ]; then
        user='anonymous'
    fi
    if [ -z $pass ]; then
        pass=''
    fi

    mysqldump -h $host -P $port -u $user -p$pass --add-drop-database --databases $dbnm -d | sed '{:q;N;s/AUTO_INCREMENT=[^ ]* //g;s/ \/\*[^*]*\*\///g;t q}' > $fn
    sed -i 's/^--.*$//g' $fn
    sed -i 's/^\/\*.*$//g' $fn
    sed -i 's/CREATE DATABASE /CREATE DATABASE IF NOT EXISTS /' $fn

    cat -s $fn > $fn.tmp

    #local CR=$(printf "\n")
    sed -e :a -e '$!N;s/\n\(USE\|CREATE .\+\)/\1/;s/\n*.*PARTITION .*\*\/;/;/;s/\n*.*PARTITION .*//;ta' -e 'P;D' $fn.tmp | sed '$d' > $fn

    rm -f $fn.tmp
}

function main() {
    dump $1 $2 $3 $4 $5
}

main $1 $2 $3 $4 $5
