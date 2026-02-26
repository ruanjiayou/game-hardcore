import ioredis from 'ioredis'
import config from '../config'

const client = new ioredis(config.redis_url);

client.on('connect', () => {
    console.log('redis connected')
})

client.on('close', () => {
    console.log('redis closed')
})

client.on('error', err => {
    console.error('redis error', err.message)
})

export default client;