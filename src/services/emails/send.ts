import nodemailer from "nodemailer"
import fs from "fs"
import path from "path"
import { Attendee, FirebaseEvent } from "../../schema/v1/FirebaseEvent";
import { getEventById } from "../events/event";
import moment from "moment"

const assetPath = path.join(__dirname, '..', '..', 'templates', 'emails', 'assets')
const templatePath = path.join(__dirname, '..', '..', 'templates', 'emails', 'event_reg_confirmation.html');

const sendEmail = async (attendee_info: Attendee) : Promise<void> => {
    let event: FirebaseEvent | null
    try {
        event = await getEventById(attendee_info.event_Id)
    } catch (error) {
        console.error(`Failed to fetch event ${attendee_info.event_Id}`)
        return;
    }

    const emailHTML = fs.readFileSync(templatePath, 'utf8')
    let transporter

    try {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',    
            auth: {
                user: process.env.PMC_EMAIL_LOGIN,
                pass: process.env.PMC_EMAIL_PWD
            },
        })

    } catch (error) {
        console.error(`Email transporter initialization failed: ${error}`)
        return;
    }

    // Replace placeholders with dynamic values
    const processedEmailHTML = emailHTML
    .replaceAll('{{First Name}}', attendee_info.first_name)
    .replaceAll('{{Event Name}}', event!.name)
    .replaceAll('{{Date}}', moment(event!.date).format("dddd, MMMM D"))
    .replaceAll('{{location}}', event!.location)
    .replace('{{desc}}', event!.description)

    // needs a random date for time formatting to work.
    .replace('{{Start Time}}', moment(`2024-12-01 ${event!.start_time}`).format("HH:mm"))
    .replace('{{End Time}}', moment(`2024-12-01 ${event!.end_time}`).format("HH:mm"))

    const mailOptions = {
        from: process.env.PMC_EMAIL_SENDER,
        to: attendee_info.email,
        subject: `Welcome to ${event!.name}, ${attendee_info.first_name}`,
        html: processedEmailHTML,
        attachments: [{
            filename: 'logo.png',
            path: `${assetPath}/logo.png`,
            cid: 'logo1' //same cid value as in the html img src
        },{
            filename: 'email_graphic.png',
            path: `${assetPath}/email_graphic.png`,
            cid: 'graphic1'
        }]
    };

    if (transporter) {
        const result = await transporter.sendMail(mailOptions);
        console.log(`Email sent:`, result.response);
    } else {
        console.error("Email error: transporter is undefined")
    }
    
}

export { sendEmail }

