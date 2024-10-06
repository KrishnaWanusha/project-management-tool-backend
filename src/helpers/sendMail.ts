import nodemailer from 'nodemailer'

export const sendEmail = async (recipients: string[], subject: any, text: any, html?: any) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    auth: {
      user: process.env.EMAIL_ADDRESS,
      pass: process.env.EMAIL_PASSWORD
    }
  })

  const mailOptions = {
    from: process.env.EMAIL_ADDRESS,
    to: recipients,
    subject,
    text,
    html
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log('Email sent:', info.response)
  } catch (error) {
    console.error('Error occurred:', error)
  }
}
