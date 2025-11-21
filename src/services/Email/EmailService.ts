import { EventProperties } from "loops";
import { loops } from "../../config/loops";
import { AttendeeRepository } from "../../storage/AttendeeRepository";
import { UserRepository } from "../../storage/UserRepository";
import { User } from "../../schema/v1/User";

enum LoopsEvent {
  MembershipPayment = "membership_payment",
  EventPayment = "event_payment",
  ApplicationReceived = "application_received",
}

const addContact = async (user: User) => {
  try {
    const resp = await loops.createContact(user.email, {
      firstName: user.firstName,
      lastName: user.lastName,
      pronouns: user.pronouns,
      university: user.university,
      faculty: user.faculty,
      major: user.major,
      year: user.year,
    });

    console.log(
      "Event:" + LoopsEvent.MembershipPayment + " email sent successfully:",
      resp
    );
  } catch (error) {
    console.error("Failed to send membership email " + error);
  }
};

const sendEmail = async (
  userId: string,
  type: LoopsEvent,
  properties?: EventProperties
) => {
  try {
    const { data, error } = await UserRepository.getUser(userId);

    if (error || !data) {
      throw new Error("User email not found: " + error?.message);
    }

    const resp = await loops.sendEvent({
      email: data.email,
      eventName: type,
      ...(type === LoopsEvent.MembershipPayment && {
        contactProperties: {
          firstName: data.first_name,
          lastName: data.last_name,
          pronouns: data.pronouns,
          university: data.university,
          faculty: data.faculty,
          major: data.major,
          year: data.year,
          pmcMember: true,
        },
      }),
      ...(properties && { eventProperties: properties }),
    });

    console.log("Event:" + type + " email sent successfully:", resp);
  } catch (error) {
    console.error("Error sending confirmation email:", error);
    throw new Error("Failed to send confirmation email");
  }
};

const addToMailingList = async (attendeeId: string) => {
  try {
    const { data, error } =
      await AttendeeRepository.getEmailAndMailingListByAttendee(attendeeId);

    if (error || !data) {
      throw new Error(
        "Attendee or associated User/Event not found: " + error?.message
      );
    }

    if (!data.Event.mailing_list) {
      throw new Error("Event does not have a mailing list configured.");
    }

    const resp = await loops.updateContact(
      data.User.email,
      {},
      { [data.Event.mailing_list]: true }
    );

    console.log("Added to mailing list successfully:", resp);
  } catch (error) {
    console.error("Error adding to mailing list:", error);
    throw new Error("Failed to add to mailing list");
  }
};

export { LoopsEvent, addContact, sendEmail, addToMailingList };
