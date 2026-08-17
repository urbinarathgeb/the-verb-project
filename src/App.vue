<script setup lang="ts">
import {RouterView} from 'vue-router'
</script>

<template>
	<div class="h-dvh w-full overflow-hidden flex flex-col">
		<main class="flex-1 min-h-0 flex flex-col">
			<RouterView />
		</main>
	</div>
</template>
