const express = require('express')
const app = express()
const admin = require('firebase-admin')
const { v4: uuidv4 } = require('uuid')
const qr = require('qrcode')

// Configuración de archivos estáticos
app.use(express.static('public'))

// Configuración de Firebase
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  universe_domain: 'googleapis.com'
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

// Middleware para procesar datos del formulario
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Ruta para la página principal
app.get('/', (req, res) => {
  res.render('crear_url', { shortenedURL: null, qrCodeDataURL: null })
})

// Ruta para las redirecciones y la página de creación de URLs
app.get('/:code', async (req, res) => {
  const code = req.params.code

  if (!code.includes('/')) {
    // Redirigir si se encuentra una URL válida
    const db = admin.firestore()
    const docRef = db.collection('urls').doc(code)

    try {
      const doc = await docRef.get()
      if (doc.exists) {
        const originalURL = doc.data().originalURL
        res.redirect(originalURL)
      } else {
        res.status(404).send('URL no encontrada.')
      }
    } catch (error) {
      console.error('Error al obtener la URL:', error)
      res.status(500).send('Error interno del servidor.')
    }
  } else {
    // Mostrar la interfaz de creación de URLs
    res.render('crear_url', { shortenedURL: null, qrCodeDataURL: null })
  }
})

// Ruta para manejar la creación de URLs acortadas
app.post('/crear', async (req, res) => {
  const originalURL = req.body.url
  const protocol = req.protocol
  const domain = req.get('host')

  // Generar código único para la URL acortada
  const code = generateUniqueCode(protocol, domain)

  const db = admin.firestore()
  const docRef = db.collection('urls').doc(code)

  try {
    // Guardar la URL original en Firestore
    await docRef.set({
      originalURL
    })

    const shortenedURL = `${protocol}://${domain}/${code}`

    // Generar el código QR para la URL acortada
    const qrCodeDataURL = await generateQRCode(shortenedURL)

    res.render('crear_url', { shortenedURL, qrCodeDataURL })
  } catch (error) {
    console.error('Error al guardar la URL:', error)
    res.status(500).send('Error interno del servidor.')
  }
})

// Función para generar un código único
function generateUniqueCode(protocol, domain) {
  return uuidv4().substring(0, 6)
}

// Función para generar un código QR
async function generateQRCode(url) {
  try {
    const options = {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      color: {
        dark: '#16222a',
        light: '#ffffff'
      },
      width: 300,
      height: 300
    }

    // Generar código QR como imagen en formato Data URL
    const qrCodeDataURL = await qr.toDataURL(url, options)
    return qrCodeDataURL
  } catch (error) {
    console.error('Error al generar el código QR:', error)
    return null
  }
}

// Configuración del servidor
const port = process.env.PORT || 3000
app.set('view engine', 'ejs')
app.use(express.static('public'))
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`)
})
