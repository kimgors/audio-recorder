import AudioRecorder from './components/AudioRecorder.vue';
import CustomWaveForm from './components/CustomWaveForm.vue';

export { AudioRecorder, CustomWaveForm };

export default {
  install: (app) => {
    app.component('AudioRecorder', AudioRecorder);
    app.component('CustomWaveForm', CustomWaveForm);
  }
};