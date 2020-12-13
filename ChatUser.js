/** Functionality related to chatting. */

const axios = require('axios');

// Room is an abstraction of a chat channel
const Room = require('./Room');

/** ChatUser is a individual connection from client -> server to chat. */

class ChatUser {
  /** make chat: store connection-device, rooom */

  constructor(send, roomName) {
    this._send = send; // "send" function for this user
    this.room = Room.get(roomName); // room user will be in
    this.name = null; // becomes the username of the visitor

    console.log(`created chat in ${this.room.name}`);
  }

  /** send msgs to this client using underlying connection-send-function */

  send(data) {
    try {
      this._send(data);
    } catch {
      // If trying to send to a user fails, ignore it
    }
  }

  /** handle joining: add to room members, announce join */

  handleJoin(name) {
    this.name = name;
    this.room.join(this);
    this.room.broadcast({
      type: 'note',
      text: `${this.name} joined "${this.room.name}".`
    });
  }

  /** handle a chat: broadcast to room. */

  handleChat(text) {
    this.room.broadcast({
      name: this.name,
      type: 'chat',
      text: text
    });
  }

  /** handle a joke request: broadcast to room. */

  handleJoke() {
    const jokePromise = axios.get('https://icanhazdadjoke.com/slack');
    this.room.broadcast({
      type: 'note',
      text: `${this.name} requested a joke.`
    });
    jokePromise.then(response => {
      const text = response.data.attachments[0].text;
      this.room.broadcast({
        name: 'Server',
        type: 'chat',
        text: text
      });
    });
  }

  /** handle a request to see all members of a chat room: send to only the requester */

  handleMembers() {
    let text = 'In room:';
    this.room.members.forEach(member => {
      text += ` ${member.name},`;
    });
    text = text.slice(0, -1);
    this.send(JSON.stringify({
      type: 'note',
      text: text
    }));
  }

  /** handle a private message: send only to the sender and recipient */

  handlePrivate(text) {
    text = text.slice(6);
    const sender = this.name;
    const recipient = text.slice(0, text.indexOf(' '));
    const message = text.slice(text.indexOf(' '));
    const data = {
      name: `${sender} (private)`,
      type: 'chat',
      text: message
    }
    for (let member of this.room.members) {
      if (member.name === recipient) {
        member.send(JSON.stringify(data));
      }
    }
    this.send(JSON.stringify(data));
  }

  /** Handle messages from client:
   *
   * - {type: "join", name: username} : join
   * - {type: "chat", text: msg }     : chat
   */

  handleMessage(jsonData) {
    let msg = JSON.parse(jsonData);

    if (msg.type === 'join') this.handleJoin(msg.name);
    else if (msg.type === 'chat') this.handleChat(msg.text);
    else if (msg.type === 'joke') this.handleJoke();
    else if (msg.type === 'members') this.handleMembers();
    else if (msg.type === 'priv') this.handlePrivate(msg.text);
    else throw new Error(`bad message: ${msg.type}`);
  }

  /** Connection was closed: leave room, announce exit to others */

  handleClose() {
    this.room.leave(this);
    this.room.broadcast({
      type: 'note',
      text: `${this.name} left ${this.room.name}.`
    });
  }
}

module.exports = ChatUser;
