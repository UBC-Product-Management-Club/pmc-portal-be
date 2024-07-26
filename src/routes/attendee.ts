import { Router } from "express";
import { getAttendeeById, addAttendee } from "../controllers/events/attendee";
<<<<<<< HEAD
import { Attendee } from "../schema/Event"
import { User } from "../schema/User";
=======
import { Attendee } from "../controllers/events/types"
>>>>>>> be898ec (updated the attendee and event registration API to insert attendee ID into array of attendees in Event)
import { v4 as uuidv4 } from 'uuid';
import { firestore } from "firebase-admin";


export const attendeeRouter = Router()

attendeeRouter.get('/:id', async (req, res) => {
    try {
        const attendeeById = await getAttendeeById(req.params.id);
        res.status(200).json(attendeeById);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

<<<<<<< HEAD
attendeeRouter.get('/:eventId', async (req, res) => {
=======
attendeeRouter.get('/attendee/:eventId', async (req, res) => {
>>>>>>> be898ec (updated the attendee and event registration API to insert attendee ID into array of attendees in Event)
    try {
        const { eventId } = req.params;
        if (!eventId) {
            return res.status(400).json({ error: 'Missing event ID' });
        }
        const attendee = await getAttendeeById(eventId);
        res.status(200).json(attendee);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

attendeeRouter.post('/addAttendee', async (req, res) => {
    const attendee_Id = uuidv4(); // might create a new field in the collection
    const requiredFields = [
        'is_member',
<<<<<<< HEAD
=======
        'member_Id',
>>>>>>> be898ec (updated the attendee and event registration API to insert attendee ID into array of attendees in Event)
        'event_Id',
        'first_name',
        'last_name',
        'student_num',
        'email',
        'year_level',
        'major',
        'faculty',
        'familiarity',
        'found_out',
        'dietary'
    ];
    // need to figure how to pass in event ID and member ID dynamically? 
    // so when users click register, it sends their current member ID (through session) and the event ID it clicked
    for (const field of requiredFields) {
        if (!req.body[field]) {
            return res.status(400).json({ error: `Missing required field: ${field}` });
        }
    }
    const { is_member, member_Id, event_Id, first_name, last_name, student_num, email, year_level, major, faculty, familiarity, found_out, dietary } = req.body;

<<<<<<< HEAD
    const newAttendee: Attendee = { attendee_Id, ...req.body };

    try {
        await addAttendee(newAttendee);
=======
    const newAttendee: Attendee = { attendee_Id, is_member, member_Id, event_Id, first_name, last_name, student_num, email, year_level, major, faculty, familiarity, found_out, dietary };

    try {
        await addAttendee(attendee_Id, newAttendee, event_Id);
>>>>>>> be898ec (updated the attendee and event registration API to insert attendee ID into array of attendees in Event)
        res.status(201).json({ message: `Attendee with ID ${attendee_Id} has been created successfully.` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});