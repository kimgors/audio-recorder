<template>
  <div class="audio-recorder">
    <!-- Confirmation Dialog -->
    <div v-if="showEditConfirmationDialog" class="dialog-overlay">
      <div class="dialog-container">
        <div class="dialog-header">
          <h3>Confirm</h3>
        </div>
        <div class="dialog-content">
          <div class="warning-icon">!</div>
          <span>
            Are you sure you wish to overwrite your current recording?
          </span>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-text" @click="showEditConfirmationDialog = false">
            <span class="icon-close"></span>
            No
          </button>
          <button class="btn btn-primary" @click="toggleRecording">
            <span class="icon-check"></span>
            Yes
          </button>
        </div>
      </div>
    </div>

    <div v-if="!isLoaded" class="skeleton"></div>
    <div class="control-container" v-if="isLoaded">
      <div class="control-row">
        <div class="button-group">
          <button 
            v-if="audioUrl"
            class="btn btn-success play-button"
            @click="playAudio">
            <span :class="isPlaying ? 'icon-pause' : 'icon-play'"></span>
            {{ isPlaying ? 'Pause Recording' : 'Play Recording' }}
          </button>
          <button
            class="btn"
            :class="recording ? 'btn-danger' : 'btn-primary'"
            @click="openConfirmationDialog">
            <span :class="recording ? 'icon-stop' : 'icon-microphone'"></span>
            {{ recording ? 'Stop Recording' : 'Start Recording' }}
          </button>
          <button 
            v-if="showSaveButton"
            class="btn btn-primary"
            :disabled="!audioUrl"
            @click="handleSave(true)">
            <span class="icon-save"></span>
            Save Audio
          </button>
        </div>
        <div v-if="!audioUrl" class="timer">
          <span class="clock-icon"></span>
          <span>{{ formatTime(timer) }}</span>
        </div>
      </div>
    </div>

    <!-- Converting Dialog -->
    <div v-if="converting" class="dialog-overlay">
      <div class="dialog-container">
        <div class="dialog-header">
          <h3>Converting Audio</h3>
        </div>
        <div class="conversion-progress">
          <div class="progress-bar-indeterminate"></div>
        </div>
      </div>
    </div>

    <div class="waveform-container" v-show="isLoaded && !audioUrl">
      <canvas 
        ref="visualizer" 
        class="wave-canvas"
        width="690"
        height="200"
      ></canvas>
    </div>

    <custom-wave-form
      v-if="isLoaded && audioUrl"
      ref="childFormRef"
      :audio-url="audioUrl"
      :update-isplaying="updateIsplaying"
      :show-play-button="false"
      wave-color="#4F4A85"
      progress-color="#383351"
    />

    <div v-if="error" class="message error">
      {{ error }}
    </div>
  </div>
</template>

<script>
import { ref, onUnmounted, onMounted } from 'vue';
import CustomWaveForm from './CustomWaveForm.vue';

export default {
  name: 'AudioRecorder',
  components: {
    CustomWaveForm
  },
  props: {
    showSaveButton: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  setup(props, { emit }) {
    const FIVE_MINUTES = 5 * 60; // 5 minutes in seconds
    const childFormRef = ref(null);
    // State
    const showEditConfirmationDialog = ref(false);
    const timerIntervalRef = ref(null);
    const timer = ref(0);
    const timerInterval = ref(null);
    const isLoaded = ref(true);
    const recording = ref(false);
    const audioUrl = ref(null);
    const error = ref(null);
    const isPlaying = ref(false);
    const converting = ref(false);
    const conversionProgress = ref(0);
    const chunks = ref([]);
    const rawBlob = ref(null);

    const WAVE_COLOR = '#4F4A85';
    const BACKGROUND_COLOR = '#f5f5f5';
    const BAR_WIDTH = 3;
    const BAR_GAP = 0.2;

    // Refs
    const visualizer = ref(null);
    const audioPlayer = ref(null);

    // Audio Context state
    const mediaRecorder = ref(null);
    const audioContext = ref(null);
    const analyser = ref(null);
    const dataArray = ref(null);
    const source = ref(null);
    const animationId = ref(null);

    const openConfirmationDialog = () => {
      if (audioUrl.value) {
        showEditConfirmationDialog.value = true;
      } else {
        showEditConfirmationDialog.value = false;
        toggleRecording();
      }
    };

    // FFmpeg initialization removed as per requirements

    const getAudioSupportedMimeType = () => {
      const types = [
        'audio/webm',
        'audio/mp4;codecs=aac',
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/wav',
        'audio/ogg'
      ];

      return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
    };

    const startRecording = async (stream) => {
      audioUrl.value = null;
      audioContext.value = new (window.AudioContext || window.webkitAudioContext)();
      analyser.value = audioContext.value.createAnalyser();
      source.value = audioContext.value.createMediaStreamSource(stream);
      source.value.connect(analyser.value);
      
      // Configure analyzer for frequency data
      analyser.value.fftSize = 2048;
      const bufferLength = analyser.value.frequencyBinCount;
      dataArray.value = new Uint8Array(bufferLength);
      const mimeType = getAudioSupportedMimeType();
      mediaRecorder.value = new MediaRecorder(stream, {
        mimeType: mimeType
      });

      chunks.value = [];
      mediaRecorder.value.ondataavailable = (e) => {
        chunks.value.push(e.data);
      };

      mediaRecorder.value.onstop = () => {
        rawBlob.value = new Blob(chunks.value, { type: 'audio/webm' });
        audioUrl.value = URL.createObjectURL(rawBlob.value);
        source.value.disconnect();
        cancelAnimationFrame(animationId.value);
        handleSave(!props.showSaveButton);
      };

      mediaRecorder.value.start();
      recording.value = true;
      startTimer();
      visualize();
    };

    // MP3 conversion removed as per requirements

    const toggleRecording = async () => {
      showEditConfirmationDialog.value = false;
      if (!recording.value) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          await startRecording(stream);
        } catch (err) {
          error.value = 'Error accessing microphone: ' + err.message;
        }
      } else {
        stopRecording();
      }
      emit('update-save-button', audioUrl.value ? true : false);
    };

    const stopRecording = () => {
      if (mediaRecorder.value && recording.value) {
        mediaRecorder.value.stop();
        recording.value = false;
        stopTimer();
      }
    };

    const handleSave = async (saveNow = true) => {
      if (!rawBlob.value) return;
      error.value = null;
      
      try {
        if (saveNow) {
          emit('recording-complete', {
            file: rawBlob.value,
          });
        }
      } catch (err) {
        error.value = err.message;
        console.error('Save error:', err);
      } finally {
        if (timerInterval.value) {
          clearInterval(timerInterval.value);
        }
        conversionProgress.value = 0;
      }
    };

    const startTimer = () => {
      timer.value = FIVE_MINUTES;
      timerInterval.value = setInterval(() => {
        timer.value--;
        if (timer.value < 1) {
          stopRecording();
        }
      }, 1000);
    };

    const stopTimer = () => {
      if (timerInterval.value) {
        clearInterval(timerInterval.value);
      }
    };

    const formatTime = (seconds) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const updateIsplaying = (value) => {
      isPlaying.value = value;
    };

    const playAudio = async () => {
      if (audioUrl.value) {
        await childFormRef.value.togglePlayPause();
      }
    };

    const visualize = () => {
      const canvas = visualizer.value;
      if (!canvas) return;
      
      const canvasCtx = canvas.getContext('2d');
      const WIDTH = canvas.width;
      const HEIGHT = canvas.height;
      
      const draw = () => {
        animationId.value = requestAnimationFrame(draw);
        
        analyser.value.getByteFrequencyData(dataArray.value);
        
        // Clear canvas with background color
        canvasCtx.fillStyle = BACKGROUND_COLOR;
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
        
        // Calculate bar width and spacing
        const totalBars = dataArray.value.length;
        const barWidth = (WIDTH / 2) / totalBars; // Half width since we're mirroring
        const centerY = HEIGHT / 2; // Get the vertical center point
        
        // Draw frequency bars
        for (let i = 0; i < totalBars; i++) {
          // Calculate bar height from frequency data
          const barHeight = (dataArray.value[i] / 255) * (HEIGHT / 2); // Half height for symmetry
          
          // Left side bars (mirrored)
          const leftX = (WIDTH / 2) - (i * barWidth) - barWidth; // Start from center, go left
          
          // Right side bars
          const rightX = (WIDTH / 2) + (i * barWidth); // Start from center, go right
          
          // Create gradients
          const gradientLeft = canvasCtx.createLinearGradient(
            leftX,
            centerY - barHeight,
            leftX,
            centerY + barHeight
          );
          gradientLeft.addColorStop(0, WAVE_COLOR);
          gradientLeft.addColorStop(0.5, WAVE_COLOR + '80');
          gradientLeft.addColorStop(1, WAVE_COLOR);
          
          const gradientRight = canvasCtx.createLinearGradient(
            rightX,
            centerY - barHeight,
            rightX,
            centerY + barHeight
          );
          gradientRight.addColorStop(0, WAVE_COLOR);
          gradientRight.addColorStop(0.5, WAVE_COLOR + '80');
          gradientRight.addColorStop(1, WAVE_COLOR);
          
          // Draw left bar
          canvasCtx.fillStyle = gradientLeft;
          canvasCtx.fillRect(
            leftX + (barWidth * BAR_GAP) / 2,
            centerY - barHeight, // Start from center going up
            barWidth * (1 - BAR_GAP),
            barHeight * 2 // Double height to go both up and down
          );
          
          // Draw right bar
          canvasCtx.fillStyle = gradientRight;
          canvasCtx.fillRect(
            rightX + (barWidth * BAR_GAP) / 2,
            centerY - barHeight, // Start from center going up
            barWidth * (1 - BAR_GAP),
            barHeight * 2 // Double height to go both up and down
          );
        }
      };

      draw();
    };

    onMounted(async () => {
      try {
        if (visualizer.value) {
          const canvas = visualizer.value;
          const ctx = canvas.getContext('2d');
          
          // Clear canvas
          ctx.fillStyle = BACKGROUND_COLOR;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw initial center line
          ctx.strokeStyle = WAVE_COLOR;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          
          const middleY = canvas.height / 2;
          
          ctx.beginPath();
          ctx.moveTo(0, middleY);
          ctx.lineTo(canvas.width, middleY);
          ctx.stroke();
          
          ctx.setLineDash([]);
        }
      } catch (err) {
        error.value = 'Failed to initialize canvas: ' + err.message;
      }
    });

    onUnmounted(() => {
      if (audioUrl.value) {
        URL.revokeObjectURL(audioUrl.value);
      }
      if (animationId.value) {
        cancelAnimationFrame(animationId.value);
      }
      if (audioContext.value) {
        audioContext.value.close();
      }
    });

    return {
      childFormRef,
      showEditConfirmationDialog,
      timer,
      isLoaded,
      recording,
      audioUrl,
      error,
      isPlaying,
      converting,
      conversionProgress,
      visualizer,
      openConfirmationDialog,
      toggleRecording,
      handleSave,
      formatTime,
      updateIsplaying,
      playAudio
    };
  }
};
</script>

<style>
.audio-recorder {
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.control-container {
  margin-bottom: 12px;
}

.control-row {
  display: flex;
  width: 100%;
  justify-content: space-between;
  align-items: center;
}

.button-group {
  display: flex;
  gap: 8px;
}

/* Button styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
  background-color: #e4e4e7;
  color: #18181b;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #4F4A85;
  color: white;
}

.btn-success {
  background-color: #10b981;
  color: white;
}

.btn-danger {
  background-color: #ef4444;
  color: white;
}

.btn-text {
  background-color: transparent;
  color: #4F4A85;
}

.play-button {
  min-width: 150px;
}

/* Icon styles */
.icon-play::before {
  content: "▶";
  margin-right: 8px;
}

.icon-pause::before {
  content: "⏸";
  margin-right: 8px;
}

.icon-stop::before {
  content: "⏹";
  margin-right: 8px;
}

.icon-microphone::before {
  content: "🎤";
  margin-right: 8px;
}

.icon-save::before {
  content: "💾";
  margin-right: 8px;
}

.icon-close::before {
  content: "✖";
  margin-right: 8px;
}

.icon-check::before {
  content: "✓";
  margin-right: 8px;
}

.timer {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.clock-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpolyline points='12 6 12 12 16 14'/%3E%3C/svg%3E");
  background-size: contain;
  margin-right: 6px;
}

.waveform-container {
  width: 100%;
  height: 150px;
  background: #f5f5f5;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 16px;
}

.wave-canvas {
  width: 100%;
  height: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
}

/* Dialog styles */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-container {
  width: 450px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.dialog-header {
  padding: 16px;
  border-bottom: 1px solid #e5e5e5;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.dialog-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.warning-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background-color: #f59e0b;
  color: white;
  font-weight: bold;
  border-radius: 50%;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 16px;
  border-top: 1px solid #e5e5e5;
}

.conversion-progress {
  text-align: center;
  padding: 16px;
}

.progress-bar-indeterminate {
  height: 4px;
  background-color: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.progress-bar-indeterminate::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  background-color: #4F4A85;
  height: 100%;
  width: 30%;
  border-radius: 2px;
  animation: progressIndeterminate 1.5s infinite;
}

@keyframes progressIndeterminate {
  0% {
    left: -30%;
  }
  100% {
    left: 100%;
  }
}

.skeleton {
  width: 100%;
  height: 200px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeletonPulse 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.message {
  margin-top: 12px;
  padding: 12px;
  border-radius: 4px;
}

.message.error {
  background-color: #fee2e2;
  color: #b91c1c;
  border: 1px solid #f87171;
}

@keyframes skeletonPulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>