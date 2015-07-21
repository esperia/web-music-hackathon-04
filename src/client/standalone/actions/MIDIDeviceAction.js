import Action from "./Action";
import MIDIKeyboard from "@mohayonao/midi-keyboard/webmidi";
import LaunchControl from "@mohayonao/launch-control/webmidi";

let devices = {};

export default class MIDIDeviceAction extends Action {
  ["/midi-device/request"]() {
    MIDIKeyboard.requestDeviceNames().then(({ inputs, outputs }) => {
      this.executeAction("/midi-device/request/inputs", { inputs });
      this.executeAction("/midi-device/request/outputs", { outputs });
    });
  }

  ["/midi-device/select"]({ target, deviceName }) {
    this.executeAction(`/midi-device/select/${target}`, { deviceName });
  }

  ["/midi-device/connect"]({ target, deviceName }) {
    let MIDIDevice = {
      "launch-control": LaunchControl,
      "midi-keyboard": MIDIKeyboard,
    }[target];

    if (!MIDIDevice) {
      return;
    }

    let promise = devices[target] ? devices[target].close() : Promise.resolve();

    promise.then(() => {
      devices[target] = null;

      let device = new MIDIDevice(deviceName);

      device.open().then(() => {
        devices[target] = device;

        this.executeAction(`/midi-device/connected/${target}`, {
          deviceName: device.deviceName,
        });

        device.on("message", (data) => {
          this.executeAction(`/${target}/${data.dataType}`, data);
        });
      }).catch((e) => {
        global.console.error(e);
      });
    });
  }
}