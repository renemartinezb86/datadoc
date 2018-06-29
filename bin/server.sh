#!/usr/bin/env bash

cygwin=false
case "`uname`" in
  CYGWIN*) cygwin=true;;
esac

function has_opt() {
  OPT_NAME=$1
  shift
  #Par the parameters
  for i in "$@"; do
    if [[ $i == $OPT_NAME ]] ; then
      echo "true"
      return
    fi
  done
  echo "false"
}

BLUE='/033[0;34m'
NC='/033[0m' # No Color

function info() {
  echo -e "${BLUE}"
  echo -e "STEP: $@"
  echo -e "###############################################################################${NC}"
  echo -e "${NC}"
}

bin=`dirname "$0"`
bin=`cd "$bin"; pwd`

APP_HOME=$(pwd)

if $cygwin; then
  JAVA_HOME="C:/CodeHome/jdk1.8.0_144"
  APP_HOME="C:/Users/proyecto/Documents/Work/SetIt/release"
fi

export APP_HOME=$APP_HOME

JAVACMD="$JAVA_HOME/bin/java"

LOG_FILE="$APP_HOME/logs/server.stdout"
PID_FILE="$APP_HOME/logs/server.pid"

mkdir -p $APP_HOME/logs

LIB="$APP_HOME/lib/*"
CLASSPATH="$JAVA_HOME/lib/tools.jar"
CLASSPATH="${CLASSPATH}:$LIB"

JAVA_OPTS="-server -XX:+UseParallelGC -Xshare:auto -Xms128m -Xmx512m"
CLASS="com.hkt.server.ServerApp"
ARGS="--app.home=$APP_HOME --spring.config.location=file:$APP_HOME/config/application.properties"

CONSOLE_OPT=$(has_opt "-console" $@ )
DAEMON_OPT=$(has_opt "-daemon" $@ )
STOP_OPT=$(has_opt "-stop" $@ )
CLEAN_OPT=$(has_opt "-clean" $@ )

echo "JAVA_HOME: $JAVA_HOME"
echo "APP_HOME:  $APP_HOME"
echo "JAVA_OPTS: $JAVA_OPTS"

cd $APP_HOME

if [ "$CLEAN_OPT" = "true" ] ; then
  info "Clean resources" 
  rm -rf log lucene storage
fi

if [ "$CONSOLE_OPT" = "true" ] ; then

  APP_OPTS="-Dcom.zaxxer.hikari.aliveBypassWindowMs=30000 -Dfile.encoding=UTF-8 -Dorg.eclipse.jetty.websocket.LEVEL=DEBUG"
  APP_OPTS="$APP_OPTS -Dapp.home=$APP_HOME"
  APP_OPTS="$APP_OPTS -DELASTIC_URL=$ELASTICSEARCH_URL"
  APP_OPTS="$APP_OPTS -DMONGO_URI=$MONGO_URI"
	echo "RUN WITH: $JAVA_HOME/bin/java -cp com.dataparse.server.RestServer "$LIB" $JAVA_OPTS $APP_OPTS "
	$JAVA_HOME/bin/java -cp "$LIB" com.dataparse.server.RestServer $JAVA_OPTS $APP_OPTS 

elif [ "$DAEMON_OPT" = "true" ] ; then
  #nohup "$JAVACMD" $JAVA_OPTS -cp "$CLASSPATH" $CLASS $ARGS > $LOG_FILE 2>&1 < /dev/null &
  #printf '%d' $! > $PID_FILE
  echo "todo........................................."
elif [ "$STOP_OPT" = "true" ] ; then
  PID=`cat $PID_FILE`
  kill -9 $PID
  echo "Stopped processs $PID"

else
  echo "Usage: "
  echo "  To run the server as daemon"
  echo "    ./server.sh -daemon "
  echo "  To stop the daemon server"
  echo "    ./server.sh -stop "
  echo "  To run the server as console"
  echo "    ./server.sh"
  echo "  Optional parameters for the console mode:"
  echo "    --app.db.load=[test,none] to load the sample test data or an empty database"
  echo "    --server.port=7080 to override the default web server port"
  echo "    --h2.server.tcp-port=8043 to override the default h2 db server port"
fi
