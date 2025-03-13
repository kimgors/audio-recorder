<!-- src/components/CustomWaveForm.vue -->
<template>
  <div>
    <button 
      v-if="showPlayButton"
      class="btn btn-success"
      @click="togglePlayPause">
      <span :class="isPlaying ? 'icon-pause' : 'icon-play'"></span>
      {{ isPlaying ? 'Pause Recording' : 'Play Recording' }}
    </button>
  </div>
  <div class="waveform-container">
    <canvas 
      ref="waveformCanvas" 
      class="waveform"
      @click="handleCanvasClick"
      @mousemove="handleMouseMove"
    ></canvas>
    
    <div 
      class="progress-bar" 
      :style="{ left: progressPosition + 'px' }"
      v-if="isPlaying || currentTime > 0"
    ></div>
  </div>
  <div class="controls">
    <span class="time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

export default {
  name: 'CustomWaveForm',
  props: {
    updateIsplaying: {
      type: Function,
      required: false
    },
    audioUrl: {
      type: String,
      required: true
    },
    showPlayButton: {
      type: Boolean,
      default: true
    },
    waveColor: {
      type: String,
      default: '#4F4A85'
    },
    progressColor: {
      type: String,
      default: '#383351'
    }
  },
  setup(props) {
    // Refs for state management
    const audioContext = ref(null);
    const audioBuffer = ref(null);
    const audioSource = ref(null);
    const isPlaying = ref(false);
    const startTime = ref(0);
    const currentTime = ref(0);
    const duration = ref(0);
    const peaks = ref([]);
    const canvasWidth = ref(0);
    const canvasHeight = ref(0);
    const animationFrame = ref(null);
    const progressPosition = ref(0);
    const waveformCanvas = ref(null);

    // Initialize audio context and load audio file
    const initAudio = async () => {
      try {
        audioContext.value = new (window.AudioContext || window.webkitAudioContext)();
        
        const response = await fetch(props.audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        audioBuffer.value = await audioContext.value.decodeAudioData(arrayBuffer);
        duration.value = audioBuffer.value.duration;
        
        await generateWaveformData();
      } catch (error) {
        console.error('Error initializing audio:', error);
      }
    };

    // Generate waveform data from audio buffer
    const generateWaveformData = async () => {
      const rawData = audioBuffer.value.getChannelData(0);
      const samples = 1000;
      const blockSize = Math.floor(rawData.length / samples);
      peaks.value = [];
      
      for (let i = 0; i < samples; i++) {
        const start = blockSize * i;
        let max = 0;
        
        for (let j = 0; j < blockSize; j++) {
          const abs = Math.abs(rawData[start + j]);
          if (abs > max) max = abs;
        }
        
        peaks.value.push(max);
      }
      
      drawWaveform();
    };

    // Initialize canvas
    const initCanvas = () => {
      const canvas = waveformCanvas.value;
      const container = canvas.parentElement;
      
      canvasWidth.value = container.clientWidth;
      canvasHeight.value = container.clientHeight;
      canvas.width = canvasWidth.value;
      canvas.height = canvasHeight.value;
      
      drawWaveform();
    };

    // Draw waveform on canvas
    const drawWaveform = () => {
      if (!peaks.value.length || !waveformCanvas.value) return;
      
      const canvas = waveformCanvas.value;
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.clearRect(0, 0, width, height);
      
      const barWidth = width / peaks.value.length;
      const barGap = 0.2;
      
      // Draw background waveform
      ctx.fillStyle = props.waveColor;
      peaks.value.forEach((peak, index) => {
        const x = index * barWidth;
        const barHeight = peak * height;
        
        ctx.fillRect(
          x + (barWidth * barGap) / 2,
          (height - barHeight) / 2,
          barWidth * (1 - barGap),
          barHeight
        );
      });
      
      // Draw progress
      if (currentTime.value > 0) {
        const progress = currentTime.value / duration.value;
        ctx.fillStyle = props.progressColor;
        
        peaks.value.forEach((peak, index) => {
          const x = index * barWidth;
          if (x / width <= progress) {
            const barHeight = peak * height;
            ctx.fillRect(
              x + (barWidth * barGap) / 2,
              (height - barHeight) / 2,
              barWidth * (1 - barGap),
              barHeight
            );
          }
        });
      }
    };

    // Playback controls
    const togglePlayPause = () => {
      if (isPlaying.value) {
        pause();
      } else {
        play();
      }
    };

    const play = () => {
      if (!audioBuffer.value) return;
      
      audioSource.value = audioContext.value.createBufferSource();
      audioSource.value.buffer = audioBuffer.value;
      audioSource.value.connect(audioContext.value.destination);
      
      startTime.value = audioContext.value.currentTime - currentTime.value;
      
      audioSource.value.start(0, currentTime.value);
      isPlaying.value = true;
      if (props.updateIsplaying) {
        props.updateIsplaying(isPlaying.value);
      }
      animate();
    };

    const pause = () => {
      if (audioSource.value) {
        audioSource.value.stop();
        audioSource.value = null;
      }
      
      if (animationFrame.value) {
        cancelAnimationFrame(animationFrame.value);
      }
      
      isPlaying.value = false;
      if (props.updateIsplaying) {
        props.updateIsplaying(isPlaying.value);
      }
    };

    // Animation frame for updating progress
    const animate = () => {
      animationFrame.value = requestAnimationFrame(animate);
      
      if (isPlaying.value) {
        currentTime.value = audioContext.value.currentTime - startTime.value;
        
        if (currentTime.value >= duration.value) {
          pause();
          currentTime.value = 0;
        }
        
        progressPosition.value = (currentTime.value / duration.value) * canvasWidth.value;
        drawWaveform();
      }
    };

    // Event handlers
    const handleCanvasClick = (event) => {
      const rect = event.target.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const seekTime = (x / canvasWidth.value) * duration.value;
      
      currentTime.value = seekTime;
      if (isPlaying.value) {
        pause();
        play();
      } else {
        progressPosition.value = (currentTime.value / duration.value) * canvasWidth.value;
        drawWaveform();
      }
    };

    const handleMouseMove = (event) => {
      // Add hover effects if needed
    };

    const handleResize = () => {
      initCanvas();
    };

    // Time formatting utility
    const formatTime = (seconds) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    // Cleanup function
    const cleanup = () => {
      if (audioSource.value) {
        audioSource.value.stop();
      }
      if (animationFrame.value) {
        cancelAnimationFrame(animationFrame.value);
      }
      if (audioContext.value) {
        audioContext.value.close();
      }
    };

    // Lifecycle hooks
    onMounted(async () => {
      await initAudio();
      initCanvas();
      window.addEventListener('resize', handleResize);
    });

    onBeforeUnmount(() => {
      cleanup();
      window.removeEventListener('resize', handleResize);
    });

    // Watch for props changes
    watch(() => props.audioUrl, async () => {
      cleanup();
      await initAudio();
    }, { deep: true });
    
    return {
      isPlaying,
      currentTime,
      duration,
      progressPosition,
      waveformCanvas,
      togglePlayPause,
      handleCanvasClick,
      handleMouseMove,
      formatTime
    };
  }
};
</script>

<style>
.waveform-container {
  position: relative;
  width: 100%;
  height: 150px;
  background: #f5f5f5;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 16px;
}

.waveform {
  width: 100%;
  height: 100%;
}

.progress-bar {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  background: #ff0000;
  pointer-events: none;
}

.controls {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.time {
  color: #666;
  font-size: 14px;
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

.btn-success {
  background-color: #10b981;
  color: white;
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
</style>