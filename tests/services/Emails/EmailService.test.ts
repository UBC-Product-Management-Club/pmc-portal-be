import { loops } from "../../../src/config/loops";
import {
  addContact,
  addToMailingList,
  LoopsEvent,
  sendEmail,
} from "../../../src/services/Email/EmailService";
import { AttendeeRepository } from "../../../src/storage/AttendeeRepository";
import { UserRepository } from "../../../src/storage/UserRepository";

jest.mock("../../../src/config/loops", () => ({
  loops: {
    sendEvent: jest.fn(),
    updateContact: jest.fn(),
    createContact: jest.fn(),
  },
}));

describe("addContact", () => {
  const mockEmail = "test@example.com";
  const mockUserId = "user-123";
  const mockUser = {
    userId: mockUserId,
    email: mockEmail,
    firstName: "geary",
    lastName: "gears",
    pronouns: "he/him",
    university: "ubc",
    faculty: "test",
    major: "test",
    year: "test",
    displayName: "",
    pfp: "",
    studentId: "",
    whyPm: "",
  };

  it("adds contact to Loops", async () => {
    (loops.sendEvent as jest.Mock).mockResolvedValue({ status: "ok" });

    await expect(addContact(mockUser)).resolves.not.toThrow();

    expect(loops.createContact).toHaveBeenCalledWith(mockEmail, {
      firstName: "geary",
      lastName: "gears",
      pronouns: "he/him",
      university: "ubc",
      faculty: "test",
      major: "test",
      year: "test",
    });
  });
});

describe("sendEmail", () => {
  const mockEmail = "test@example.com";
  const mockUserId = "user-123";
  const mockUser = {
    user_id: mockUserId,
    email: mockEmail,
    first_name: "geary",
    last_name: "gears",
    pronouns: "he/him",
    university: "ubc",
    faculty: "test",
    major: "test",
    year: "test",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends confirmation email successfully", async () => {
    (UserRepository.getUser as jest.Mock).mockResolvedValue({
      data: mockUser,
      error: null,
    });

    (loops.sendEvent as jest.Mock).mockResolvedValue({ status: "ok" });

    await expect(
      sendEmail(mockUserId, LoopsEvent.MembershipPayment)
    ).resolves.not.toThrow();

    expect(UserRepository.getUser).toHaveBeenCalledWith(mockUserId);
    expect(loops.sendEvent).toHaveBeenCalledWith({
      email: mockEmail,
      eventName: LoopsEvent.MembershipPayment,
      contactProperties: {
        firstName: "geary",
        lastName: "gears",
        pronouns: "he/him",
        university: "ubc",
        faculty: "test",
        major: "test",
        year: "test",
        pmcMember: true,
      },
    });
  });

  it("throws if user not found", async () => {
    (UserRepository.getUser as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error("Not found"),
    });

    await expect(
      sendEmail(mockUserId, LoopsEvent.MembershipPayment)
    ).rejects.toThrow("Failed to send confirmation email");
  });
});

describe("addToMailingList", () => {
  const mockAttendeeId = "attendee-123";
  const mockEmail = "attendee@example.com";
  const mailingList = "newsletter_list";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds attendee to mailing list successfully", async () => {
    (
      AttendeeRepository.getEmailAndMailingListByAttendee as jest.Mock
    ).mockResolvedValue({
      data: {
        User: { email: mockEmail },
        Event: { mailing_list: mailingList },
      },
      error: null,
    });

    (loops.updateContact as jest.Mock).mockResolvedValue({ status: "ok" });

    await expect(addToMailingList(mockAttendeeId)).resolves.not.toThrow();

    expect(
      AttendeeRepository.getEmailAndMailingListByAttendee
    ).toHaveBeenCalledWith(mockAttendeeId);

    expect(loops.updateContact).toHaveBeenCalledWith(
      mockEmail,
      {},
      { [mailingList]: true }
    );
  });

  it("throws if attendee not found", async () => {
    (
      AttendeeRepository.getEmailAndMailingListByAttendee as jest.Mock
    ).mockResolvedValue({
      data: null,
      error: new Error("Missing"),
    });

    await expect(addToMailingList(mockAttendeeId)).rejects.toThrow(
      "Failed to add to mailing list"
    );
  });

  it("throws if event has no mailing list configured", async () => {
    (
      AttendeeRepository.getEmailAndMailingListByAttendee as jest.Mock
    ).mockResolvedValue({
      data: {
        User: { email: mockEmail },
        Event: { mailing_list: null },
      },
      error: null,
    });

    await expect(addToMailingList(mockAttendeeId)).rejects.toThrow(
      "Failed to add to mailing list"
    );
  });
});
