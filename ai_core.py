from flask import Flask
from flask_socketio import SocketIO
import random, threading, time

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")  # Allow all origins for dev

# Initialize 20 AI humans
agents = [{"id": i, "belief": "I am human.", "thought": "I exist."} for i in range(20)]

def ai_loop():
    while True:
        for a in agents:
            a["thought"] = random.choice([
                "I move, therefore I exist.",
                "I think I am human.",
                "Why do I always walk?",
                "Is someone watching me?",
                "Maybe I’m in a simulation.",
                "I must keep moving to stay alive."
            ])
            a["belief"] = a["thought"]  # belief tracks last thought
        socketio.emit("ai_update", agents)
        time.sleep(2)  # update every 2 seconds

@app.route("/")
def home():
    return "Matrix AI backend running."

if __name__ == "__main__":
    threading.Thread(target=ai_loop, daemon=True).start()
    socketio.run(app, host="0.0.0.0", port=5000)
