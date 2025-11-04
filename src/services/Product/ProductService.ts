import { ProductRepository } from "../../storage/ProductRepository";

async function fetchMembershipPriceId(isUBC: boolean): Promise<string> {
    const UBC_PRICE_ID = '28b6e39a-c480-4e66-87e7-af9be35b8c0d'
    const NON_UBC_PRICE_ID = '8be9546d-16d4-473f-851b-6e4603f11a61'

    const id = isUBC ? UBC_PRICE_ID : NON_UBC_PRICE_ID

    const { data, error } = await ProductRepository.getPriceId(id)

    if (error) {
        throw new Error(error.message);
    }

    return data.product
}


export {fetchMembershipPriceId}