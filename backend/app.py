import streamlit as st
import pandas as pd

from webmail_fetcher import fetch_latest_emails
from predict import predict_batch, predict_single_email


st.set_page_config(
    page_title="IITD Webmail Classifier",
    layout="wide"
)

st.title("IITD Webmail Classifier")

tab1, tab2 = st.tabs(["Classify Webmail", "Classify Manual Email"])


with tab1:
    st.subheader("Fetch and classify emails from IITD Webmail")

    limit = st.slider("Number of latest emails", 1, 50, 10)
    unread_only = st.checkbox("Unread emails only", value=False)

    if st.button("Fetch and Classify"):
        with st.spinner("Fetching emails..."):
            emails = fetch_latest_emails(limit=limit, unread_only=unread_only)

        if not emails:
            st.warning("No emails found.")
        else:
            with st.spinner("Classifying emails..."):
                result_df = predict_batch(emails)

            st.success("Classification complete.")

            st.dataframe(
                result_df[[
                    "Subject",
                    "From",
                    "Date",
                    "Urgency",
                    "Predicted Classification"
                ]],
                use_container_width=True
            )

            selected_idx = st.number_input(
                "Enter email index to view body",
                min_value=0,
                max_value=len(result_df) - 1,
                value=0
            )

            st.subheader("Selected Email Body")
            st.write(result_df.iloc[selected_idx]["Body"])


with tab2:
    st.subheader("Manually classify one email")

    subject = st.text_input("Subject")
    sender = st.text_input("From")
    urgency = st.selectbox("Urgency", ["normal", "urgent"])
    body = st.text_area("Body", height=250)

    if st.button("Classify Manual Email"):
        result = predict_single_email(
            subject=subject,
            sender=sender,
            body=body,
            urgency=urgency
        )

        st.success(f"Prediction: {result['classification']}")

        if "confidence_score" in result:
            st.write("Confidence score:", result["confidence_score"])