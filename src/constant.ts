const constant = {
  GAME: {
    GENRE: {
      fps: 'fps',
      moba: 'moba',
      rpg: 'rpg',
      card: 'card',
      puzzle: 'puzzle',
    }
  },
  ROOM: {
    STATUS: {
      waiting: 'waiting',
      ready: 'ready',
      loading: 'loading',
      playing: 'playing',
      deleted: 'deleted',
    }
  },
  USER: {
    STATUS: {
      normal: 1,
      muted: 2,
      banned: 3,
    },
  },
  PLAYER: {
    STATE: {
      idle: 'idle',
      ready: 'ready',
      playing: 'playing',
      matching: 'matching',
    }
  }
}

export default constant