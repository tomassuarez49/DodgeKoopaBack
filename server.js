const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// Habilitar CORS
app.use(cors());

// Ruta principal para verificar el estado del servidor
app.get('/', (req, res) => {
    res.send('Servidor backend funcionando correctamente.');
});

// Estado del juego
let gameState = {
    players: {},
    ballPosition: null,
    obstacles: [...Array(10).keys()].map(row => row * 11 + 5), // Obstáculos en la columna 6
};

// Inicializar posición de la pelota
function initializeBallPosition() {
    let validPositionFound = false;

    while (!validPositionFound) {
        const randomPosition = Math.floor(Math.random() * 110); // Tamaño del grid (10x11)
        if (!gameState.obstacles.includes(randomPosition)) {
            gameState.ballPosition = randomPosition;
            validPositionFound = true;
        }
    }

    console.log(`Pelota inicial colocada en la posición: ${gameState.ballPosition}`);
}
initializeBallPosition();

// Manejar conexiones WebSocket
wss.on('connection', (ws) => {
    console.log('Nuevo jugador conectado');

    ws.send(JSON.stringify({
        type: 'updateGameState',
        players: gameState.players,
        ballPosition: gameState.ballPosition,
        obstacles: gameState.obstacles,
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'newPlayer':
                    if (data.username && typeof data.position === 'number' && data.color) {
                        gameState.players[data.username] = {
                            position: data.position,
                            color: data.color,
                        };
                        console.log(`Jugador añadido: ${data.username}`);
                        broadcastGameState();
                    } else {
                        console.warn("Mensaje 'newPlayer' inválido recibido:", data);
                    }
                    break;

                case 'move':
                    if (data.username && gameState.players[data.username]) {
                        gameState.players[data.username].position = data.position;
                        console.log(`Jugador ${data.username} movido a posición ${data.position}`);
                        broadcastGameState();
                    } else {
                        console.warn("Mensaje 'move' inválido recibido:", data);
                    }
                    break;

                case 'updateBall':
                    if (typeof data.position === 'number') {
                        gameState.ballPosition = data.position;
                        console.log(`Posición de la pelota actualizada a: ${data.position}`);
                        broadcastGameState();
                    } else {
                        console.warn("Mensaje 'updateBall' inválido recibido:", data);
                    }
                    break;

                case 'playerEliminated':
                    if (data.username && gameState.players[data.username]) {
                        delete gameState.players[data.username];
                        console.log(`Jugador eliminado: ${data.username}`);
                        broadcastGameState();
                    }
                    break;

                default:
                    console.warn("Mensaje desconocido recibido:", data);
            }
        } catch (error) {
            console.error("Error procesando mensaje:", error);
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`WebSocket cerrado. Código: ${code}, Razón: ${reason}`);
    });

    ws.on('error', (err) => {
        console.error('Error en WebSocket:', err);
    });
});

// Función para enviar el estado del juego
function broadcastGameState() {
    gameState.players = Object.fromEntries(
        Object.entries(gameState.players).filter(([key, value]) => key && value && key.trim())
    );

    const message = {
        type: 'updateGameState',
        players: gameState.players,
        ballPosition: gameState.ballPosition,
        obstacles: gameState.obstacles,
    };

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Inicia el servidor en el puerto 8080
server.listen(8080, () => {
    console.log('Servidor corriendo en el puerto 8080');
});
