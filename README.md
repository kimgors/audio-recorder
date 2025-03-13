# Vue Audio Recorder Component

A Vue 3 audio recorder component with waveform visualization.

## Features

- Record audio directly from the browser
- Real-time audio visualization during recording
- Customizable waveform rendering
- Playback controls for recorded audio
- Responsive design

## Installation

```bash
npm install vue-audio-recorder-component
```

## Usage

### Register globally

```javascript
import { createApp } from 'vue';
import App from './App.vue';
import VueAudioRecorder from 'vue-audio-recorder-component';
import 'vue-audio-recorder-component/dist/audio-recorder.css';

const app = createApp(App);
app.use(VueAudioRecorder);
app.mount('#app');
```

### Register locally

```javascript
import { AudioRecorder } from 'vue-audio-recorder-component';
import 'vue-audio-recorder-component/dist/audio-recorder.css';

export default {
  components: {
    AudioRecorder
  }
}
```

### Basic usage

```html
<template>
  <AudioRecorder 
    :question="question"
    :lesson-id="lessonId"
    :course-id="courseId"
    :show-save-button="true"
    @recording-complete="handleRecordingComplete"
  />
</template>

<script>
export default {
  data() {
    return {
      question: { id: 1, text: 'Recording question' },
      lessonId: 101,
      courseId: 5
    }
  },
  methods: {
    handleRecordingComplete(data) {
      console.log('Recording complete:', data);
      // { file: Blob, question: Object }
    }
  }
}
</script>
```

## Components

### AudioRecorder

The main component for recording audio.

#### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| showSaveButton | Boolean | false | Whether to show a save button |

#### Events

| Name | Parameters | Description |
|------|------------|-------------|
| recording-complete | { file, question } | Emitted when recording is completed and saved |
| update-save-button | Boolean | Emitted when save button state should update |

### CustomWaveForm

Component for displaying audio waveforms and playback controls.

#### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| audioUrl | String | required | URL to the audio file |
| updateIsplaying | Function | null | Callback when playback state changes |
| showPlayButton | Boolean | true | Whether to show play button |
| waveColor | String | '#4F4A85' | Color of the waveform |
| progressColor | String | '#383351' | Color of the progress indicator |

## License

MIT