#!/bin/bash

set -e

cd ../sounds/
mv ~/Downloads/export-audio.sh .
chmod +x ./export-audio.sh
OUTPUT_DIR="../starflow-3d/public/audio" ./export-audio.sh
rm ./export-audio.sh

