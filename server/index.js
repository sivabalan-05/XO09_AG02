import app from './app.js'

const port = Number(process.env.AGENT_PORT || 8787)
app.listen(port, () => console.log(`Verity agent API listening on http://127.0.0.1:${port}`))
