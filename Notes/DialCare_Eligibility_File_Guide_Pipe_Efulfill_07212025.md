Electronic Eligibility Guide
Electronic Eligibility Guide
Contents Page
1. General Guidelines .............................................................................................................. 3

2. File Format and Naming Convention .................................................................................. 4

3. Initial Testing ....................................................................................................................... 4

4. Transmission and Security .................................................................................................. 4

5. File Layout – Member Record ............................................................................................. 5

6. Appendix A – Converting an Excel file to the Care ington format .......................................^6

1. General Guidelines

Full Files

•Positive active (full) membership files are preferred. Full files ensure that our system is synchronized with
the client system.
•Processing frequency is based on activity. Full files should be submitted at least once a month with a 4 day
timeframe before the end of month, to ensure accurate billing. Full files can also be accepted weekly.
•The full file can contain active and cancelled members. But there should only be one record per
member/Unique ID. Members not present in the Full file will be termed by absence.
Please note files will not process if the same Unique ID and Group Code combination is used multiple
times.
•Multiple group codes can be listed in one eligibility file.

Note : If a Full file is sent with no member records for a group code, no members in the missing group will be
affected. If we receive one or more members for a group code, all members in that group not listed in the
file will be cancelled.
Delta/Change Files

•Delta files are similar to full files but they contain limited number of records. The file format remains the
same.
•Members not submitted in Delta files will not be cancelled.
•Delta files can be accepted weekly if the volume is high. Follow the file naming convention described in
Section 3 to clearly indicate the Delta file.

Unique ID

Every record requires a unique ID number to be listed; the file will not process without a unique ID number.
•We recommend a numeric unique ID. Alpha-numeric ID’s are acceptable as well.
•Unique ID number for dependents will be the same as the primary member.
•Sequence number distinguishes the records, (i.e. Member=00, dep1=01, dep2=02, etc.)
•Primary members that sign up for more than one group code (product configuration) may be assigned the
same unique ID for each group code.
Member Effective Dates

Care ington accepts first of month effective dates only.
Mid-month dates sent in the file will be converted to 1st of month effective dates based on Careington’s
programming logic:
o 1 st- 15 th = First of current month
o 16 th-End Of Month = First of next month.
Effective dates cannot be updated via eligibility Files.
Member Termination

Members not present in the Full file will be termed by absence. The termination date is assigned based off
the file run date.
Termination dates should always be as of first day of a month.
•Once our system terms a member, it will ignore termination dates sent in files. No updates can be made to a
termed record in our system besides reinstatement.
•To reinstate a member, re-send the member in the file with the original unique ID and do not include a term
date.
Dependent Information

If dependent information is being sent to Care ington, it must be sent with the member’s information.
Dependent information may not be required to be sent to Care ington; it depends on the product
configuration. Some vendors require eligibility and dependent information.
•If a dependent is cancelling membership and the member is not, send the cancellation for the dependent,
but also include the member’s active information in the file.
Optional Fields

If an optional field does not contain data please leave empty, with no characters between the delimiters. i.e.
Mr|Mark||Johnson
2. File Format and Naming Convention

The eligibility file is a pipe delimited text file.
•Naming Convention:
Full File: GROUPCODEMMDDYY_ full .txt
Delta File: GROUPCODEMMDDYY_ delta .txt
•If multiple group codes are submitted in the same file, please use the Careington-created parent group code
in the file name. Your Care ington Account Manager can provide you with the parent group code.
e.g. PARENTGROUPCODEMMDDYY_full.txt and PARENTGROUPCODEMMDDYY_delta.txt
•We only except pipe delimited files with .txt or .csv file extensions (Please see Appendix A for instructions on
converting an excel file to pipe delimited)
3. Initial Testing

Test file – must be reviewed and approved by Care ington prior to sending live member data.
•It is a pipe delimited file containing dummy information with at least 3 member records and at least 1
dependent record (if applicable).
•Email elig@careington.com with the words TEST FILE and the Group Code in the subject line.
•Please copy your Account Manager on the email for follow up.
4. Transmission and Security

Eligibility must be encrypted via SFTP.
Note: email notification to elig@careington.com must accompany SFTP Transfer.
•Please contact your account manager to setup SFTP connectivity.
•We recommend PGP for encrypting all electronic information.
Careington File Layout
Member Record

07/21/
Appendix A

Converting an Excel file to Careington Format

Format the entire spreadsheet as text.
a. Right-click the triangle in the top left where the columns and rows meet.
b. Select Format Cells and switch to the Number tab.
c. Under Category, select Text and click OK.
Enter all required fields as specified with an *asterisk.
Make sure the date format is correct – MMDDYYYY (8 digits).
Use reasonable dates (For example, do not use the year 2999).
Ensure there are no special characters or output.
a. Make sure any fields with no data are represented by empty cells.
i. Remove all instances of #NULL!
b. Ensure the column spacing is correct.
i. If dates or phone numbers are showing up as ####### or 1.1E+
1. Expand the column width by double-clicking the separator between the current
column’s header and the next. This will automatically expand the width as far as
necessary.
Make sure the Unique ID is the same for all members of a family, and that the Sequence Numbers are
different.
Save the file in pipe delimited format.
a. To ensure pipe is set as your default list separator:
i. Go to Start, Control Panel
ii. Open Region and Language settings
iii. In the Formats tab, select Additional Settings
iv. Under the Numbers tab, change the list separator to |
v. Press the OK button to save the pipe as your default list separator
b. In Excel, go to File, Save As.
c. Change the Save as type to CSV (Comma delimited) (*.csv)
d. Set the filename:
i. PARENTGROUPCODEMMDDYY_full for Full Files
ii. PARENTGROUPCODEMMDDYY_delta for Delta Files
NOTE: You can change the extension as you see fit. (.txt or .csv)