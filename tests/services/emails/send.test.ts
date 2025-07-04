import * as fs from 'fs';
import * as nodemailer from 'nodemailer';
import { Attendee } from '../../../src/schema/Event';
import { sendEmail } from '../../../src/services/emails/send'
import { getEventById } from '../../../src/services/events/event'

jest.mock('fs');
jest.mock('../../../src/services/events/event');
jest.mock('nodemailer');

const mockedGetEventById = getEventById as jest.MockedFunction<typeof getEventById>;
const mockedReadFileSync = fs.readFileSync as jest.Mock;
const mockedCreateTransport = nodemailer.createTransport as jest.Mock;
let sendMailMock: jest.Mock;

describe('sendEmail', () => {

    const fakeEvent = {
        event_Id: 'e123',
        name: 'Tech Talk',
        date: '2024-12-01',
        start_time: '15:00:00',
        end_time: '17:00:00',
        location: 'Main Hall',
        description: 'A Fun Event',
        media: [],
        member_price: 0,
        non_member_price: 0,
        attendee_Ids: [],
        member_only: false,
        maxAttendee: 100,
        eventFormId: undefined,
        isDisabled: false,
        points: {},
    };

    const fakeAttendee: Attendee ={
        attendee_Id: 'a1',
        is_member: true,
        member_Id: 'm1',
        event_Id: 'e123',
        first_name: 'Alice',
        last_name: 'Smith',
        email: 'alice@test.com',
        familiarity: "advanced",
        found_out: 'friend',
        dietary: '',
        event_form_answers: {},
        activities_attended: [],
        points: 0,
    };

    beforeEach(() => {
        mockedGetEventById.mockResolvedValue(fakeEvent);
        mockedReadFileSync.mockReturnValue(`
            <h1>Hi {{First Name}},</h1>
            <p>We’re thrilled to let you know that you’ve secured a spot at {{Event Name}}!</p>
            <div>
                <p><strong>Date:</strong> {{Date}}</p>
                <p><strong>Time:</strong> {{Start Time}} - {{End Time}}</p>
                <p><strong>Location/Link:</strong> {{location}}</p>
            </div>
            <h2>What to Expect:</h2>
            <p>{{desc}}</p>
        `);

        sendMailMock = jest.fn().mockResolvedValue({ response: '250 OK' });
        mockedCreateTransport.mockReturnValue({ sendMail: sendMailMock });
    });

    it('successfully sends email', async () => {
        await sendEmail(fakeAttendee);
        expect(mockedCreateTransport).toHaveBeenCalled();
        expect(sendMailMock).toHaveBeenCalledTimes(1);
        expect(sendMailMock).toHaveCalledWithMailInfo(
            fakeAttendee.email,
            'Welcome to Tech Talk',
            ['Hi Alice', 'Tech Talk', 'Sunday, December 1', '15:00', '17:00', 'Main Hall', 'A Fun Event']
        );
    });
});
