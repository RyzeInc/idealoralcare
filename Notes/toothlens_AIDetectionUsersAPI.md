# Detection Users API

This guide explains how **Ryzehealth** integrates with the Toothlens detection system.
Ryzehealth manages multiple client companies. Each user must belong to a **company** so scans
can be tracked correctly.

# Integration Flow

1. Ryzehealth shares the **company name** with Toothlens (via email or any
    communication).
2. Toothlens **sets up the company internally**.
3. Ryzehealth calls the **Auth API** to generate a token.
4. Using the token, Ryzehealth creates users for that company.
5. Start AI scan using the created UID.

# 1. Company Setup

Ryzehealth must first share the **company name** with the Toothlens team.
This can be shared through **email or any agreed communication channel**.
The Toothlens team will then **configure the company internally** before user onboarding
begins.

## Company Name Guidelines

✔ Good Practices
● Use **lowercase letters only**
● Use the **full company name as one word**
● Keep the company name consistent across integrations


✘ Bad Practices
● Using spaces in the company name
● Using special characters such as _, - , or symbols
● Using uppercase letters
Example:
✔ Correct
idealhealth
✘ Incorrect
IdealHealth
ideal_health
ideal-health
ideal health

# 2. Authentication API

Use this API to get a **token**. The token is required before creating users.

## API

POST https://annotation.toothlens.com/api/v1/detection-users/auth

## Payload

### {

"company": "ryzehealth",
"access_key": "your_access_key"
}

## Response

### {

"status": 200,
"message": "Authentication successful",
"data": {
"token": "your_jwt_token",
"company": "ryzehealth"
}
}


## Guidelines

✔ Good Practices
● Authenticate before calling any protected API
● Save the token securely in your application
● Reuse the token until it expires
✘ Bad Practices
● Sending empty company or access key
● Sharing your token publicly
● Requesting a new token for every request unnecessarily

# 3. Create Detection User

Use this API to create users under a **specific company.
The Auth API token must be used for every user creation request.**

## API

POST https://annotation.toothlens.com/api/v1/detection-users

## Headers

Authorization: Bearer <token>
Content-Type: application/json

## Payload

### {

"company": "idealhealth",
"uid": "AB17727051852593C",
"name": "Aarav Mehta",
"age": 34,
"gender": "male",
"email": "aarav.mehta@example.com",
"phone_number": "+919876543210",
"city": "mumbai",
"state": "maharashtra",
"country": "india",
"zip_code": "400001"
}


## Response

### {

"status": 201,
"message": "Detection user created successfully",
"data":{
"company": "idealhealth",
"uid": "AB17727051852593C",
"name": "Aarav Mehta",
"age": 34,
"gender": "male",
"email": "aarav.mehta@example.com",
"phone_number": "+919876543210",
"city": "mumbai",
"state": "maharashtra",
"country": "india",
"zip_code": "400001"
}
}

## Guidelines

✔ Good Practices
● Always include **Authorization Bearer token**
● If UID not mentioned. System will auto generate and share you back.
● **name** : Use the full name of the user (example: Aarav Mehta)
● **age** : Should be a valid number (example: 25 , 34 , 52 )
● **gender** : Use simple values like male, female, or other
● **city, state, country** : Use full names instead of short forms
● **zip_code** : Should be a valid postal or zip code
● **phone_number** : Always include the **country code** (example: +919876543210)
● **email** : Must be a valid email format
✘ Bad Practices
● Calling this API without authentication
● Using an expired token
● Sending duplicate UID values
● Sending invalid JSON payload


# UID Rules

If UID is not provided, the system generates one automatically.

## Example

### AB17727051852593C

## Rules

```
● Minimum length: 4 characters
● Must be unique
● Optional field
```
# Basic Flow

1 ⃣ Authenticate
POST /detection-users/auth
Get token
2 ⃣ Create User
POST /detection-users
Send token in Authorization header
3 ⃣ 4 If Token Expires
Authenticate again and get a new token

# 4. Start AI Scan

Once a **UID is created** , you can start the AI scan using the following link.

## URL

https://selfcheck.toothlens.com/ai/{company}?uid={uid}&session_id={session_id}

## Parameters

### ● UID

```
The UID of the user that was created using the Create Detection User API.
The same uid can be reused when the same user performs multiple scans.
● session_id
A unique ID for every scan. You must generate a new session_id each time a new
scan starts.
```

## Guidelines

✔ Good Practices
● Always pass the correct **uid** returned from the API
● Reuse the **same uid** if the same user performs multiple scans
● Generate a **new session_id for every scan**
● Ensure session_id is always unique
✘ Bad Practices
● Reusing the same **session_id** for multiple scans
● Using an invalid or non-existing **uid**
● Starting a scan before creating the user


