import Alpine from 'alpinejs'
import api from './api.js'
import pipes from './stores/pipes.js'
import modals from './stores/modals.js'
import login from './components/login.js'
import appShell from './components/app-shell.js'
import board from './components/board.js'
import comments from './components/comments.js'
import notifications from './components/notifications.js'
import files from './components/files.js'
import modalComponents from './components/modals.js'

api(Alpine)
pipes(Alpine)
modals(Alpine)
login(Alpine)
appShell(Alpine)
board(Alpine)
comments(Alpine)
notifications(Alpine)
files(Alpine)
modalComponents(Alpine)

window.Alpine = Alpine
Alpine.start()
