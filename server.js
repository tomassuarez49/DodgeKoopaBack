const WebSocket = require('ws');
const express = require('express');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

let gameState = {
    players: {},
    ballPosition: null,
    obstacles: [...Array(10).keys()].map(row => row * 11 + 5), // Ejemplo: obstáculos en la columna 6
};
// Función para inicializar la posición de la pelota
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

// Inicializa la posición de la pelota al iniciar el servidor
initializeBallPosition();


// Manejar nuevas conexiones WebSocket
wss.on('connection', (ws) => {
    console.log('Nuevo jugador conectado');

    // Enviar el estado inicial del juego al cliente
    ws.send(JSON.stringify({
        type: 'updateGameState',
        players: gameState.players,
        ballPosition: gameState.ballPosition,
        obstacles: gameState.obstacles,
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log("Mensaje recibido del cliente:", data); 

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
                            gameState.ballPosition = data.position; // Actualizar la posición de la pelota en el estado global
                            console.log(`Posición de la pelota actualizada a: ${data.position}`);
                            broadcastGameState(); // Notificar a todos los clientes la nueva posición
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

    ws.on('close', () => {
        console.log('Jugador desconectado');
    });
});

// Servir los archivos estáticos del frontend
app.use(express.static('../frontend'));

// Inicia el servidor en el puerto 8080
server.listen(8080, () => {
    console.log('Servidor corriendo en http://192.168.10.33:8080');
});

function broadcastGameState() {
    // Limpia jugadores inválidos antes de enviar
    gameState.players = Object.fromEntries(
        Object.entries(gameState.players).filter(([key, value]) => key && value && key.trim())
    );

    console.log("Estado del juego enviado:", gameState);

    const message = {
        type: 'updateGameState', // Agregar el tipo de mensaje
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



/* ACA SI FUNCIONA EL REALTIME 
function broadcastGameState() {
    // Limpia jugadores inválidos antes de enviar
    gameState.players = Object.fromEntries(
        Object.entries(gameState.players).filter(([key, value]) => key && value && key.trim())
    );

    console.log("Estado del juego enviado:", gameState);

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'updatePlayers', // Agregar el campo de tipo
                players: gameState.players,
                ballPosition: gameState.ballPosition,
                obstacles: gameState.obstacles
            }));
        }
    });
}
*/
