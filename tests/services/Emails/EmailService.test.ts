import { loops } from "../../../src/config/loops";
import { addToMailingList, ConfirmationEvent, sendConfirmationEmail } from "../../../src/services/Email/EmailService";
import { AttendeeRepository } from "../../../src/storage/AttendeeRepository";
import { UserRepository } from "../../../src/storage/UserRepository";

jest.mock("../../../src/config/loops", () => ({
    loops: {
        sendEvent: jest.fn(),
        updateContact: jest.fn()
    }
}));

describe("sendConfirmationEmail", () => {
    const mockEmail = "test@example.com";
    const mockUserId = "user-123";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("sends confirmation email successfully", async () => {
        (UserRepository.getEmailByUserId as jest.Mock).mockResolvedValue({
            data: { email: mockEmail },
            error: null,
        });

        (loops.sendEvent as jest.Mock).mockResolvedValue({ status: "ok" });

        await expect(sendConfirmationEmail(mockUserId, ConfirmationEvent.MembershipPayment))
            .resolves.not.toThrow();

        expect(UserRepository.getEmailByUserId).toHaveBeenCalledWith(mockUserId);
        expect(loops.sendEvent).toHaveBeenCalledWith({
            email: mockEmail,
            eventName: ConfirmationEvent.MembershipPayment,
        });
    });

    it("throws if user email not found", async () => {
        (UserRepository.getEmailByUserId as jest.Mock).mockResolvedValue({
            data: null,
            error: new Error("Not found"),
        });

        await expect(sendConfirmationEmail(mockUserId, ConfirmationEvent.MembershipPayment))
            .rejects.toThrow("Failed to send confirmation email");
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
        (AttendeeRepository.getEmailAndMailingListByAttendee as jest.Mock).mockResolvedValue({
            data: {
                User: { email: mockEmail },
                Event: { mailing_list: mailingList },
            },
            error: null,
        });

        (loops.updateContact as jest.Mock).mockResolvedValue({ status: "ok" });

        await expect(addToMailingList(mockAttendeeId)).resolves.not.toThrow();

        expect(AttendeeRepository.getEmailAndMailingListByAttendee)
            .toHaveBeenCalledWith(mockAttendeeId);

        expect(loops.updateContact).toHaveBeenCalledWith(
            mockEmail,
            {},
            { [mailingList]: true }
        );
    });

    it("throws if attendee not found", async () => {
        (AttendeeRepository.getEmailAndMailingListByAttendee as jest.Mock).mockResolvedValue({
            data: null,
            error: new Error("Missing"),
        });

        await expect(addToMailingList(mockAttendeeId))
            .rejects.toThrow("Failed to add to mailing list");
    });

    it("throws if event has no mailing list configured", async () => {
        (AttendeeRepository.getEmailAndMailingListByAttendee as jest.Mock).mockResolvedValue({
            data: {
                User: { email: mockEmail },
                Event: { mailing_list: null },
            },
            error: null,
        });

        await expect(addToMailingList(mockAttendeeId))
            .rejects.toThrow("Failed to add to mailing list");
    });
});
