import { useEffect, useState } from "react";
import { Button, Fieldset, Stack } from "@chakra-ui/react";
import { Field } from "../../components/ui/field";
import { Switch } from "../../components/ui/switch";
import {
  NativeSelectField,
  NativeSelectRoot,
} from "../../components/ui/native-select";

const Settings = () => {
  const [currencies, setCurrencies] = useState([]);
  const [languages, setLanguages] = useState([]);

  // Fetch Currencies
  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD") // Exchange Rate API
      .then((res) => res.json())
      .then((data) => {
        if (data.rates) {
          setCurrencies(Object.keys(data.rates));
        }
      })
      .catch((err) => console.error("Error fetching currencies:", err));
  }, []);

  // Fetch Languages
  useEffect(() => {
    fetch("https://restcountries.com/v3.1/all?fields=languages") // RestCountries API
      .then((res) => res.json())
      .then((data) => {
        const uniqueLanguages = new Set();
        data.forEach((country) => {
          if (country.languages) {
            Object.values(country.languages).forEach((lang) => uniqueLanguages.add(lang));
          }
        });
        setLanguages([...uniqueLanguages].sort());
      })
      .catch((err) => console.error("Error fetching languages:", err));
  }, []);

  return (
    <Fieldset.Root size="lg" maxW="md">
      <Stack>
        <Fieldset.Legend>Settings</Fieldset.Legend>
        <Fieldset.HelperText>Manage your preferences below.</Fieldset.HelperText>
      </Stack>

      <Fieldset.Content>
        {/* Currency */}
        <Field label="Currency">
          <NativeSelectRoot>
            <NativeSelectField
              name="currency"
              items={currencies.length > 0 ? currencies : ["Loading..."]}
            />
          </NativeSelectRoot>
        </Field>

        {/* Language */}
        <Field label="Language">
          <NativeSelectRoot>
            <NativeSelectField
              name="language"
              items={languages.length > 0 ? languages : ["Loading..."]}
            />
          </NativeSelectRoot>
        </Field>

        {/* Theme Mode */}
        <Field label="Theme Mode">
          <Switch>Dark Mode</Switch>
        </Field>

        {/* Date Format */}
        <Field label="Date Format">
          <NativeSelectRoot>
            <NativeSelectField
              name="dateFormat"
              items={["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]}
            />
          </NativeSelectRoot>
        </Field>

        {/* Number Formatting */}
        <Field label="Number Formatting">
          <NativeSelectRoot>
            <NativeSelectField
              name="numberFormat"
              items={["1,000.00", "1.000,00", "1000.00"]}
            />
          </NativeSelectRoot>
        </Field>

        {/* Default Account */}
        <Field label="Default Account">
          <NativeSelectRoot>
            <NativeSelectField
              name="defaultAccount"
              items={["Main Account", "Savings", "Credit Card"]}
            />
          </NativeSelectRoot>
        </Field>

        {/* Export Data */}
        <Button alignSelf="flex-start" mt={4} colorScheme="blue">
          Export Data
        </Button>
      </Fieldset.Content>
    </Fieldset.Root>
  );
};

export default Settings;

