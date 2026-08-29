/** Provider contract keeps payment orchestration independent of Paystack. */
export interface PaymentProvider {
  requestMobileMoney(input: { reference: string; email: string; amount: number; phone: string; network: string }): Promise<{ reference: string; status: string; providerTransactionId?: string }>;
  verifyPayment(reference: string): Promise<{ reference: string; status: string; amount: number; currency: string; providerTransactionId?: string }>;
  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean;
}
