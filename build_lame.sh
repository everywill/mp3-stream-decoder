LIB_PATH=lame
CFLAGS="-O2"
ROOT_DIR=$PWD
BUILD_DIR=$ROOT_DIR/build/Macos
CONF_FLAGS=(
  --prefix=$BUILD_DIR                                 # install library in a build directory for FFmpeg to include
  --disable-shared                                    # disable shared library
  --disable-frontend                                  # exclude lame executable
  --disable-analyzer-hooks                            # exclude analyzer hooks
  --disable-dependency-tracking                       # speed up one-time build
  --disable-gtktest
)
echo "CONF_FLAGS=${CONF_FLAGS[@]}"
(cd $LIB_PATH && CFLAGS=$CFLAGS ./configure "${CONF_FLAGS[@]}")
make -C $LIB_PATH install -j
make -C $LIB_PATH clean