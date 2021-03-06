import path from "path";
import dgram from "dgram";
import OscMessage from "osc-msg";
import { Dispatcher } from "@mohayonao/dispatcher";
import MIDIKeyboard from "@mohayonao/midi-keyboard";
import LaunchControl from "@mohayonao/launch-control";
import logger from "./logger";
import config from "./config";
import utils from "../utils";

let dispatcher = new Dispatcher();
let launchControl, midiKeyboard, oscSocket;

function useLaunchControl() {
  launchControl = new LaunchControl(config.MIDI_CONTROLLER_NAME);

  launchControl.on("message", (data) => {
    dispatcher.dispatch(`/launch-control/${data.dataType}`, data);
  });

  launchControl.open().then(() => {
    launchControl.led("all", "off", 8);
    dispatcher.dispatch("/midi-device/connect/launch-control", {
      deviceName: launchControl.deviceName,
    });
    logger.info(`MIDIController: ${launchControl.deviceName}`);
  }).catch((e) => {
    logger.error(e.message);
  });
}

function useMIDIKeyboard() {
  midiKeyboard = new MIDIKeyboard(config.MIDI_KEYBOARD_NAME);

  midiKeyboard.on("message", (data) => {
    data.playbackTime = Date.now();
    data.channel = 8;

    dispatcher.dispatch(`/midi-keyboard/${data.dataType}`, data);
  });

  midiKeyboard.open().then(() => {
    dispatcher.dispatch("/midi-device/connect/midi-keyboard", {
      deviceName: midiKeyboard.deviceName,
    });
    logger.info(`MIDIKeyboard: ${midiKeyboard.deviceName}`);
  }).catch((e) => {
    logger.error(e.message);
  });
}

function useOSCReceiver() {
  oscSocket = dgram.createSocket("udp4");

  oscSocket.on("message", (buffer) => {
    let msg = OscMessage.fromBuffer(buffer);

    if (msg.error) {
      return;
    }

    if (msg.elements) {
      msg = msg.elements[0] || {};
    }
    if (!msg.args) {
      return;
    }
    logger.debug("> " + JSON.stringify(msg));

    let address = path.join("/osc", msg.address);
    let args = msg.args.map(value => value.value);

    dispatcher.dispatch(address, { address, args });
  });

  oscSocket.bind(config.OSC_RECV_PORT, () => {
    logger.info("Listening OSC on port %d", oscSocket.address().port);
  });
}

function sendOSC(msg) {
  if (!oscSocket) {
    oscSocket = dgram.createSocket("udp4");
  }

  let buffer = OscMessage.toBuffer(msg);
  let { OSC_SEND_PORT, OSC_SEND_HOST } = config;

  oscSocket.send(buffer, 0, buffer.length, OSC_SEND_PORT, OSC_SEND_HOST, () => {
    logger.debug("< " + JSON.stringify(msg));
  });
}

function setLED(track, color) {
  if (launchControl) {
    launchControl.led(track, color, 8);
  }
}

export default utils.xtend(utils, {
  dispatcher,
  useLaunchControl: utils.once(useLaunchControl),
  useMIDIKeyboard: utils.once(useMIDIKeyboard),
  useOSCReceiver: utils.once(useOSCReceiver),
  sendOSC: sendOSC,
  setLED: setLED,
});
